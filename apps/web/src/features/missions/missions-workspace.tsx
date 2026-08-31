'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { ApiRequestError, getMissions } from '../../lib/api-client';
import { MissionDetailPanel } from '../control-tower/mission-detail-panel';
import { useSession } from '../auth/session-provider';
import { MissionCreateForm } from './mission-create-form';
import type { PaginatedMissions } from './types';

export function MissionsWorkspace({ accessToken }: { accessToken: string }) {
  const { hasPermission } = useSession();
  const [missions, setMissions] = useState<PaginatedMissions>();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [selectedId, setSelectedId] = useState<string>();
  const [revision, setRevision] = useState(0);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      page: String(page),
      limit: '25',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    if (search) query.set('search', search);
    if (status) query.set('status', status);
    void getMissions(accessToken, query, controller.signal)
      .then((response) => {
        setMissions(response);
        setError(undefined);
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted)
          setError(
            requestError instanceof ApiRequestError
              ? requestError.message
              : 'Unable to load missions',
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [accessToken, page, revision, search, status]);

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  return (
    <main className="dashboard">
      <header className="topbar">
        <div>
          <p className="eyebrow">OPERATIONS</p>
          <h1>Missions</h1>
          <p className="muted">Tenant missions, assignments, stops, events, and closure evidence</p>
        </div>
        {hasPermission('mission.create') ? (
          <button className="primary-button" onClick={() => setCreating(true)}>
            Create mission
          </button>
        ) : null}
      </header>
      {creating ? (
        <MissionCreateForm
          accessToken={accessToken}
          onCancel={() => setCreating(false)}
          onCreated={(missionId) => {
            setCreating(false);
            setSelectedId(missionId);
            setRevision((value) => value + 1);
          }}
        />
      ) : null}
      <section className="operations-panel" aria-labelledby="missions-title">
        <div className="panel-heading">
          <div>
            <h2 id="missions-title">Mission registry</h2>
            <p>{missions ? `${missions.meta.total} missions` : 'Loading mission totals…'}</p>
          </div>
          <form className="filters" onSubmit={applyFilters}>
            <label className="search-field">
              <span className="sr-only">Search missions</span>
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Mission number or cargo"
              />
            </label>
            <label>
              <span className="sr-only">Mission status</span>
              <select
                aria-label="Mission status"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="LOADING">Loading</option>
                <option value="IN_TRANSIT">In transit</option>
                <option value="DELIVERED">Delivered</option>
                <option value="CLOSED">Closed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </label>
            <button className="filter-button" type="submit">
              Apply
            </button>
          </form>
        </div>
        {error ? (
          <div className="state-panel error-state" role="alert">
            <strong>Missions unavailable</strong>
            <span>{error}</span>
            <button
              className="quiet-button"
              onClick={() => {
                setLoading(true);
                setError(undefined);
                setRevision((value) => value + 1);
              }}
            >
              Retry
            </button>
          </div>
        ) : null}
        {loading && !missions ? (
          <div className="state-panel" role="status">
            Loading missions…
          </div>
        ) : null}
        {missions ? (
          <div className="mission-table-wrap">
            <table className="mission-table">
              <thead>
                <tr>
                  <th>Mission</th>
                  <th>Status</th>
                  <th>Client & warehouse</th>
                  <th>Assignment</th>
                  <th>Scheduled loading</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {missions.data.map((mission) => (
                  <tr key={mission.id}>
                    <td>
                      <strong>{mission.missionNo}</strong>
                      <small>{mission.cargoType ?? 'Cargo not specified'}</small>
                    </td>
                    <td>
                      <span className={`status-badge status-${mission.status.toLowerCase()}`}>
                        {mission.status.replaceAll('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <span>{mission.client.name}</span>
                      <small>{mission.warehouse.name}</small>
                    </td>
                    <td>
                      <span>{mission.carrier?.name ?? 'Unassigned'}</span>
                      <small>{mission.route?.name ?? 'No route'}</small>
                    </td>
                    <td>
                      {mission.scheduledLoadingAt ? (
                        <time dateTime={mission.scheduledLoadingAt}>
                          {new Date(mission.scheduledLoadingAt).toLocaleString()}
                        </time>
                      ) : (
                        <span className="muted">Not scheduled</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="mission-view-button"
                        onClick={() => setSelectedId(mission.id)}
                      >
                        View details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {missions && missions.data.length === 0 ? (
          <div className="state-panel">No missions match the current filters.</div>
        ) : null}
        {missions && missions.meta.totalPages > 1 ? (
          <div className="pagination">
            <button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>
              Previous
            </button>
            <span>
              Page {page} of {missions.meta.totalPages}
            </span>
            <button
              disabled={page === missions.meta.totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </button>
          </div>
        ) : null}
      </section>
      {selectedId ? (
        <MissionDetailPanel
          key={`${selectedId}:${revision}`}
          accessToken={accessToken}
          missionId={selectedId}
          onClose={() => setSelectedId(undefined)}
          onChanged={() => setRevision((value) => value + 1)}
          enableWorkflow
        />
      ) : null}
    </main>
  );
}
