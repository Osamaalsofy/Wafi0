'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  addMissionStop,
  ApiRequestError,
  assignMission,
  completeMissionStop,
  getAvailableMissionTransitions,
  getExceptions,
  listResource,
  recordMissionStopArrival,
  startMissionStopUnloading,
  startRouteDeviation,
  transitionMission,
  updateMission,
  updateMissionStop,
} from '../../lib/api-client';
import type { MissionDetail, MissionStop } from '../control-tower/types';
import type { PaginatedExceptions } from '../exceptions/types';
import { useSession } from '../auth/session-provider';
import type { AvailableMissionTransitions, EntityOption, MissionStopWriteInput } from './types';

function localDateTime(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function iso(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}
function numeric(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim();
  return text ? Number(text) : undefined;
}

export function MissionWorkflowActions({
  accessToken,
  mission,
  onChanged,
}: {
  accessToken: string;
  mission: MissionDetail;
  onChanged: () => void;
}) {
  const { hasPermission } = useSession();
  const [carriers, setCarriers] = useState<EntityOption[]>([]);
  const [vehicles, setVehicles] = useState<EntityOption[]>([]);
  const [drivers, setDrivers] = useState<EntityOption[]>([]);
  const [warehouses, setWarehouses] = useState<EntityOption[]>([]);
  const [contracts, setContracts] = useState<EntityOption[]>([]);
  const [routes, setRoutes] = useState<EntityOption[]>([]);
  const [branches, setBranches] = useState<EntityOption[]>([]);
  const [transitions, setTransitions] = useState<AvailableMissionTransitions>();
  const [exceptions, setExceptions] = useState<PaginatedExceptions>();
  const [carrierId, setCarrierId] = useState(mission.carrier?.id ?? '');
  const [vehicleId, setVehicleId] = useState(mission.vehicle?.id ?? '');
  const [driverId, setDriverId] = useState(mission.driver?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();
    const active = new URLSearchParams({ page: '1', limit: '100', status: 'ACTIVE' });
    const client = new URLSearchParams(active);
    client.set('clientId', mission.client.id);
    const exceptionQuery = new URLSearchParams({ page: '1', limit: '100', missionId: mission.id });
    void Promise.all([
      listResource<EntityOption>(accessToken, '/carriers', active, controller.signal),
      listResource<EntityOption>(accessToken, '/warehouses', client, controller.signal),
      listResource<EntityOption>(accessToken, '/contracts', client, controller.signal),
      listResource<EntityOption>(accessToken, '/routes', client, controller.signal),
      listResource<EntityOption>(accessToken, '/branches', client, controller.signal),
      getAvailableMissionTransitions(accessToken, mission.id, controller.signal),
      getExceptions(accessToken, exceptionQuery, controller.signal),
    ])
      .then(
        ([
          carrierPage,
          warehousePage,
          contractPage,
          routePage,
          branchPage,
          transitionData,
          exceptionPage,
        ]) => {
          setCarriers(carrierPage.data);
          setWarehouses(warehousePage.data);
          setContracts(contractPage.data);
          setRoutes(routePage.data);
          setBranches(branchPage.data);
          setTransitions(transitionData);
          setExceptions(exceptionPage);
        },
      )
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted)
          setError(
            requestError instanceof ApiRequestError
              ? requestError.message
              : 'Unable to load mission workflow options',
          );
      });
    return () => controller.abort();
  }, [accessToken, mission.client.id, mission.id]);

  useEffect(() => {
    if (!carrierId) {
      queueMicrotask(() => {
        setVehicles([]);
        setDrivers([]);
      });
      return;
    }
    const controller = new AbortController();
    const query = new URLSearchParams({ page: '1', limit: '100', status: 'ACTIVE', carrierId });
    void Promise.all([
      listResource<EntityOption>(accessToken, '/vehicles', query, controller.signal),
      listResource<EntityOption>(accessToken, '/drivers', query, controller.signal),
    ])
      .then(([vehiclePage, driverPage]) => {
        setVehicles(vehiclePage.data);
        setDrivers(driverPage.data);
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted)
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'Unable to load carrier resources',
          );
      });
    return () => controller.abort();
  }, [accessToken, carrierId]);

  const sortedStops = useMemo(
    () => [...mission.stops].sort((a, b) => a.sequence - b.sequence),
    [mission.stops],
  );
  async function mutate(operation: () => Promise<unknown>) {
    setBusy(true);
    setError(undefined);
    try {
      await operation();
      onChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Mission action failed');
    } finally {
      setBusy(false);
    }
  }

  async function editMission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await mutate(() =>
      updateMission(accessToken, mission.id, {
        clientId: mission.client.id,
        warehouseId: String(data.get('warehouseId')),
        contractId: String(data.get('contractId')) || null,
        routeId: String(data.get('routeId')) || null,
        cargoType: String(data.get('cargoType')).trim() || undefined,
        scheduledLoadingAt: iso(String(data.get('scheduledLoadingAt'))),
        scheduledDepartureAt: iso(String(data.get('scheduledDepartureAt'))),
        notes: String(data.get('notes')).trim() || undefined,
      }),
    );
  }
  async function addStop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await mutate(() =>
      addMissionStop(accessToken, mission.id, {
        branchId: String(data.get('branchId')),
        sequence: Number(data.get('sequence')),
        expectedArrival: iso(String(data.get('expectedArrival'))),
        expectedQty: numeric(data.get('expectedQty')),
        notes: String(data.get('notes')).trim() || undefined,
      }),
    );
  }
  async function transition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await mutate(() =>
      transitionMission(accessToken, mission.id, {
        toStatus: String(data.get('toStatus')),
        reason: String(data.get('reason')).trim() || undefined,
      }),
    );
  }

  return (
    <section className="detail-section workflow-section" aria-labelledby="workflow-title">
      <div className="detail-section-heading">
        <h3 id="workflow-title">Mission workflow</h3>
        <span>Server validated</span>
      </div>
      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="workflow-grid">
        {hasPermission('exception.manage') && mission.route ? (
          <details>
            <summary>Route deviation</summary>
            <form
              className="workflow-form"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void mutate(() =>
                  startRouteDeviation(
                    accessToken,
                    mission.id,
                    new Date(String(data.get('occurredAt'))).toISOString(),
                  ),
                );
              }}
            >
              <p>Open one active route-deviation incident for this mission.</p>
              <label>
                Deviation detected at
                <input
                  name="occurredAt"
                  type="datetime-local"
                  required
                  defaultValue={localDateTime(new Date().toISOString())}
                />
              </label>
              <button className="danger" disabled={busy}>
                Record deviation
              </button>
            </form>
          </details>
        ) : null}
        {hasPermission('mission.update') ? (
          <details>
            <summary>Edit mission</summary>
            <form className="workflow-form" onSubmit={(event) => void editMission(event)}>
              <label>
                Warehouse
                <select name="warehouseId" required defaultValue={mission.warehouse.id}>
                  {warehouses.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.code}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Contract
                <select name="contractId" defaultValue={mission.contract?.id ?? ''}>
                  <option value="">No contract</option>
                  {contracts
                    .filter((item) => item.status === 'ACTIVE')
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · {item.code}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Route
                <select name="routeId" defaultValue={mission.route?.id ?? ''}>
                  <option value="">No route</option>
                  {routes
                    .filter((item) => item.status === 'ACTIVE')
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · {item.code}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Cargo type
                <input name="cargoType" defaultValue={mission.cargoType ?? ''} />
              </label>
              <label>
                Scheduled loading
                <input
                  name="scheduledLoadingAt"
                  type="datetime-local"
                  defaultValue={localDateTime(mission.scheduledLoadingAt)}
                />
              </label>
              <label>
                Scheduled departure
                <input
                  name="scheduledDepartureAt"
                  type="datetime-local"
                  defaultValue={localDateTime(mission.scheduledDepartureAt)}
                />
              </label>
              <label>
                Notes
                <textarea name="notes" defaultValue={mission.notes ?? ''} />
              </label>
              <button className="filter-button" disabled={busy}>
                Save mission
              </button>
            </form>
          </details>
        ) : null}
        {hasPermission('mission.assign') ? (
          <details>
            <summary>Assignment</summary>
            <div className="workflow-form">
              <label>
                Carrier
                <select
                  value={carrierId}
                  onChange={(event) => {
                    setCarrierId(event.target.value);
                    setVehicleId('');
                    setDriverId('');
                  }}
                >
                  <option value="">Select carrier</option>
                  {carriers.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.code}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Vehicle
                <select
                  value={vehicleId}
                  disabled={!carrierId}
                  onChange={(event) => setVehicleId(event.target.value)}
                >
                  <option value="">Select vehicle</option>
                  {vehicles.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.plateNo}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Driver
                <select
                  value={driverId}
                  disabled={!carrierId}
                  onChange={(event) => setDriverId(event.target.value)}
                >
                  <option value="">Select driver</option>
                  {drivers.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="filter-button"
                disabled={busy || !carrierId || !vehicleId || !driverId}
                onClick={() =>
                  void mutate(() =>
                    assignMission(accessToken, mission.id, { carrierId, vehicleId, driverId }),
                  )
                }
              >
                Save assignment
              </button>
            </div>
          </details>
        ) : null}
        {hasPermission('mission.transition') ? (
          <details open={Boolean(transitions?.transitions.length)}>
            <summary>Status transition</summary>
            {transitions?.transitions.length ? (
              <form className="workflow-form" onSubmit={(event) => void transition(event)}>
                <label>
                  Next status
                  <select name="toStatus" required>
                    {transitions.transitions.map((status) => (
                      <option key={status} value={status}>
                        {status.replaceAll('_', ' ')}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Reason
                  <input name="reason" placeholder="Required when cancelling" />
                </label>
                <button className="filter-button" disabled={busy}>
                  Apply transition
                </button>
              </form>
            ) : (
              <p className="empty-copy">No further transitions are available.</p>
            )}
          </details>
        ) : null}
        {hasPermission('mission_stop.create') ? (
          <details>
            <summary>Add stop</summary>
            <form className="workflow-form" onSubmit={(event) => void addStop(event)}>
              <label>
                Branch
                <select required name="branchId">
                  <option value="">Select branch</option>
                  {branches.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.code}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Sequence
                <input
                  required
                  name="sequence"
                  type="number"
                  min="1"
                  defaultValue={sortedStops.length + 1}
                />
              </label>
              <label>
                Expected arrival
                <input name="expectedArrival" type="datetime-local" />
              </label>
              <label>
                Expected quantity
                <input name="expectedQty" type="number" min="0" step="0.001" />
              </label>
              <label>
                Notes
                <textarea name="notes" />
              </label>
              <button className="filter-button" disabled={busy}>
                Add stop
              </button>
            </form>
          </details>
        ) : null}
      </div>
      <div className="workflow-stop-list">
        {sortedStops.map((stop) => (
          <StopWorkflow
            key={stop.id}
            accessToken={accessToken}
            stop={stop}
            branches={branches}
            busy={busy}
            hasPermission={hasPermission}
            mutate={mutate}
          />
        ))}
      </div>
      <div className="related-exceptions">
        <h4>Related exceptions</h4>
        {exceptions?.data.length ? (
          <ul>
            {exceptions.data.map((item) => (
              <li key={item.id}>
                <strong>{item.ruleCode}</strong>
                <span>
                  {item.severity ?? 'UNRATED'} · {item.status}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-copy">No related exceptions.</p>
        )}
      </div>
    </section>
  );
}

function StopWorkflow({
  accessToken,
  stop,
  branches,
  busy,
  hasPermission,
  mutate,
}: {
  accessToken: string;
  stop: MissionStop;
  branches: EntityOption[];
  busy: boolean;
  hasPermission: (permission: string) => boolean;
  mutate: (operation: () => Promise<unknown>) => Promise<void>;
}) {
  async function edit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const input: MissionStopWriteInput = {
      branchId: String(data.get('branchId')),
      sequence: Number(data.get('sequence')),
      expectedArrival: iso(String(data.get('expectedArrival'))),
      expectedQty: numeric(data.get('expectedQty')),
      notes: String(data.get('notes')).trim() || undefined,
    };
    await mutate(() => updateMissionStop(accessToken, stop.id, input));
  }
  async function complete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await mutate(() =>
      completeMissionStop(accessToken, stop.id, {
        receivedQty: numeric(data.get('receivedQty')),
        rejectedQty: numeric(data.get('rejectedQty')),
        shortageQty: numeric(data.get('shortageQty')),
        notes: String(data.get('completionNotes')).trim() || undefined,
      }),
    );
  }
  return (
    <article className="workflow-stop">
      <header>
        <strong>
          Stop {stop.sequence} · {stop.branch.name}
        </strong>
        <span>{stop.status.replaceAll('_', ' ')}</span>
      </header>
      <div className="inline-actions">
        {stop.status === 'PENDING' && hasPermission('mission_stop.arrive') ? (
          <button
            disabled={busy}
            onClick={() => void mutate(() => recordMissionStopArrival(accessToken, stop.id))}
          >
            Record arrival
          </button>
        ) : null}
        {stop.status === 'ARRIVED' && hasPermission('mission_stop.unload') ? (
          <button
            disabled={busy}
            onClick={() => void mutate(() => startMissionStopUnloading(accessToken, stop.id))}
          >
            Start unloading
          </button>
        ) : null}
      </div>
      {hasPermission('mission_stop.update') ? (
        <details>
          <summary>Edit stop / reorder</summary>
          <form className="workflow-form" onSubmit={(event) => void edit(event)}>
            <label>
              Branch
              <select name="branchId" defaultValue={stop.branch.id}>
                {branches.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.code}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sequence
              <input name="sequence" type="number" min="1" defaultValue={stop.sequence} />
            </label>
            <label>
              Expected arrival
              <input
                name="expectedArrival"
                type="datetime-local"
                defaultValue={localDateTime(stop.expectedArrival)}
              />
            </label>
            <label>
              Expected quantity
              <input
                name="expectedQty"
                type="number"
                min="0"
                step="0.001"
                defaultValue={stop.expectedQty ?? ''}
              />
            </label>
            <label>
              Notes
              <textarea name="notes" defaultValue={stop.notes ?? ''} />
            </label>
            <button disabled={busy}>Save stop</button>
          </form>
        </details>
      ) : null}
      {stop.status === 'UNLOADING' && hasPermission('mission_stop.complete') ? (
        <details>
          <summary>Complete stop</summary>
          <form className="workflow-form" onSubmit={(event) => void complete(event)}>
            <label>
              Received quantity
              <input name="receivedQty" type="number" min="0" step="0.001" />
            </label>
            <label>
              Rejected quantity
              <input name="rejectedQty" type="number" min="0" step="0.001" />
            </label>
            <label>
              Shortage quantity
              <input name="shortageQty" type="number" min="0" step="0.001" />
            </label>
            <label>
              Completion notes
              <textarea name="completionNotes" />
            </label>
            <button disabled={busy}>Complete stop</button>
          </form>
        </details>
      ) : null}
    </article>
  );
}
