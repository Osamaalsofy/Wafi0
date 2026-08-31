'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ApiRequestError, createMission, listResource } from '../../lib/api-client';
import type { EntityOption, MissionWriteInput } from './types';

function optionalIso(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

export function MissionCreateForm({
  accessToken,
  onCreated,
  onCancel,
}: {
  accessToken: string;
  onCreated: (missionId: string) => void;
  onCancel: () => void;
}) {
  const [clients, setClients] = useState<EntityOption[]>([]);
  const [warehouses, setWarehouses] = useState<EntityOption[]>([]);
  const [contracts, setContracts] = useState<EntityOption[]>([]);
  const [routes, setRoutes] = useState<EntityOption[]>([]);
  const [form, setForm] = useState({
    missionNo: '',
    clientId: '',
    warehouseId: '',
    contractId: '',
    routeId: '',
    cargoType: '',
    scheduledLoadingAt: '',
    scheduledDepartureAt: '',
    notes: '',
  });
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ page: '1', limit: '100', status: 'ACTIVE' });
    void Promise.all([
      listResource<EntityOption>(accessToken, '/clients', query, controller.signal),
      listResource<EntityOption>(accessToken, '/warehouses', query, controller.signal),
    ])
      .then(([clientPage, warehousePage]) => {
        setClients(clientPage.data);
        setWarehouses(warehousePage.data);
        setError(undefined);
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted)
          setError(
            requestError instanceof ApiRequestError
              ? requestError.message
              : 'Unable to load mission options',
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingOptions(false);
      });
    return () => controller.abort();
  }, [accessToken]);

  useEffect(() => {
    if (!form.clientId) {
      queueMicrotask(() => {
        setContracts([]);
        setRoutes([]);
      });
      return;
    }
    const controller = new AbortController();
    const query = new URLSearchParams({ page: '1', limit: '100', clientId: form.clientId });
    void Promise.all([
      listResource<EntityOption>(accessToken, '/contracts', query, controller.signal),
      listResource<EntityOption>(accessToken, '/routes', query, controller.signal),
    ])
      .then(([contractPage, routePage]) => {
        setContracts(contractPage.data);
        setRoutes(routePage.data);
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted)
          setError(
            requestError instanceof Error ? requestError.message : 'Unable to load client options',
          );
      });
    return () => controller.abort();
  }, [accessToken, form.clientId]);

  const clientWarehouses = useMemo(
    () => warehouses.filter((item) => item.clientId === form.clientId),
    [form.clientId, warehouses],
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    const input: MissionWriteInput = {
      missionNo: form.missionNo.trim(),
      clientId: form.clientId,
      warehouseId: form.warehouseId,
      contractId: form.contractId || undefined,
      routeId: form.routeId || undefined,
      cargoType: form.cargoType.trim() || undefined,
      scheduledLoadingAt: optionalIso(form.scheduledLoadingAt),
      scheduledDepartureAt: optionalIso(form.scheduledDepartureAt),
      notes: form.notes.trim() || undefined,
    };
    try {
      const mission = await createMission(accessToken, input);
      onCreated(mission.id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to create mission');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="operations-panel mission-editor">
      <div className="panel-heading">
        <div>
          <h2>Create mission</h2>
          <p>All relationships are validated by the backend</p>
        </div>
        <button className="quiet-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {error ? (
        <div className="form-error" role="alert">
          {error}
        </div>
      ) : null}
      {loadingOptions ? (
        <div className="state-panel" role="status">
          Loading mission options…
        </div>
      ) : (
        <form className="master-form" onSubmit={submit}>
          <label>
            Mission number
            <input
              required
              maxLength={80}
              value={form.missionNo}
              onChange={(event) => setForm({ ...form, missionNo: event.target.value })}
            />
          </label>
          <label>
            Client
            <select
              required
              value={form.clientId}
              onChange={(event) =>
                setForm({
                  ...form,
                  clientId: event.target.value,
                  warehouseId: '',
                  contractId: '',
                  routeId: '',
                })
              }
            >
              <option value="">Select client</option>
              {clients.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.code}
                </option>
              ))}
            </select>
          </label>
          <label>
            Warehouse
            <select
              required
              disabled={!form.clientId}
              value={form.warehouseId}
              onChange={(event) => setForm({ ...form, warehouseId: event.target.value })}
            >
              <option value="">Select warehouse</option>
              {clientWarehouses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.code}
                </option>
              ))}
            </select>
          </label>
          <label>
            Contract
            <select
              disabled={!form.clientId}
              value={form.contractId}
              onChange={(event) => setForm({ ...form, contractId: event.target.value })}
            >
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
            <select
              disabled={!form.clientId}
              value={form.routeId}
              onChange={(event) => setForm({ ...form, routeId: event.target.value })}
            >
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
            <input
              value={form.cargoType}
              onChange={(event) => setForm({ ...form, cargoType: event.target.value })}
            />
          </label>
          <label>
            Scheduled loading
            <input
              type="datetime-local"
              value={form.scheduledLoadingAt}
              onChange={(event) => setForm({ ...form, scheduledLoadingAt: event.target.value })}
            />
          </label>
          <label>
            Scheduled departure
            <input
              type="datetime-local"
              value={form.scheduledDepartureAt}
              onChange={(event) => setForm({ ...form, scheduledDepartureAt: event.target.value })}
            />
          </label>
          <label className="wide-field">
            Notes
            <textarea
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </label>
          <button className="primary-button" disabled={busy}>
            {busy ? 'Creating…' : 'Create mission'}
          </button>
        </form>
      )}
    </section>
  );
}
