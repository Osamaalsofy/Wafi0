'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  ApiRequestError,
  archiveResource,
  createResource,
  listResource,
} from '../../lib/api-client';
import { useSession } from '../auth/session-provider';

interface Contract {
  id: string;
  code: string;
  name: string;
  cadence: string;
  status: string;
  effectiveFrom: string;
  effectiveTo: string;
  parties: Array<{ partyType: string; partyId: string }>;
}
interface EntityOption {
  id: string;
  code?: string;
  name?: string;
  plateNo?: string;
}

export function ContractsWorkspace({ accessToken }: { accessToken: string }) {
  const { hasPermission } = useSession();
  const [records, setRecords] = useState<{
    data: Contract[];
    meta: { total: number; totalPages: number };
  }>();
  const [form, setForm] = useState({
    code: '',
    name: '',
    cadence: 'ANNUAL',
    effectiveFrom: '',
    effectiveTo: '',
    partyType: 'CLIENT',
    partyId: '',
  });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [partyOptions, setPartyOptions] = useState<EntityOption[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    const path =
      form.partyType === 'CLIENT'
        ? '/clients'
        : form.partyType === 'CARRIER'
          ? '/carriers'
          : '/drivers';
    void listResource<EntityOption>(
      accessToken,
      path,
      new URLSearchParams({ page: '1', limit: '100', status: 'ACTIVE' }),
      controller.signal,
    )
      .then((response) => setPartyOptions(response.data))
      .catch(() => setPartyOptions([]));
    return () => controller.abort();
  }, [accessToken, form.partyType]);
  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ page: String(page), limit: '25' });
    if (search) query.set('search', search);
    if (status) query.set('status', status);
    void listResource<Contract>(accessToken, '/contracts', query, controller.signal)
      .then((response) => {
        setRecords(response);
        setError(undefined);
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted)
          setError(
            requestError instanceof ApiRequestError
              ? requestError.message
              : 'Unable to load contracts',
          );
      });
    return () => controller.abort();
  }, [accessToken, page, revision, search, status]);
  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await createResource(accessToken, '/contracts', {
        code: form.code.trim(),
        name: form.name.trim(),
        cadence: form.cadence,
        effectiveFrom: new Date(form.effectiveFrom).toISOString(),
        effectiveTo: new Date(form.effectiveTo).toISOString(),
        parties: [{ partyType: form.partyType, partyId: form.partyId.trim() }],
      });
      setForm({ ...form, code: '', name: '', partyId: '' });
      setRevision((value) => value + 1);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to create contract');
    } finally {
      setBusy(false);
    }
  }
  async function deactivate(id: string) {
    setBusy(true);
    try {
      await archiveResource(accessToken, `/contracts/${id}/deactivate`);
      setRevision((value) => value + 1);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Unable to deactivate contract',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="dashboard">
      <header className="topbar">
        <div>
          <p className="eyebrow">COMMERCIAL OPERATIONS</p>
          <h1>Contracts</h1>
          <p className="muted">Effective service agreements and operational parties</p>
        </div>
      </header>
      {hasPermission('contract.manage') ? (
        <section className="operations-panel compact-panel">
          <div className="panel-heading">
            <div>
              <h2>Create contract</h2>
              <p>Effective-to is exclusive in backend validation</p>
            </div>
          </div>
          <form className="filters master-form" onSubmit={create}>
            <label>
              Code
              <input
                required
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value })}
              />
            </label>
            <label>
              Name
              <input
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
            <label>
              Cadence
              <select
                value={form.cadence}
                onChange={(event) => setForm({ ...form, cadence: event.target.value })}
              >
                <option>DAILY</option>
                <option>WEEKLY</option>
                <option>MONTHLY</option>
                <option>ANNUAL</option>
              </select>
            </label>
            <label>
              Effective from
              <input
                required
                type="datetime-local"
                value={form.effectiveFrom}
                onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })}
              />
            </label>
            <label>
              Effective to
              <input
                required
                type="datetime-local"
                value={form.effectiveTo}
                onChange={(event) => setForm({ ...form, effectiveTo: event.target.value })}
              />
            </label>
            <label>
              Party type
              <select
                value={form.partyType}
                onChange={(event) => setForm({ ...form, partyType: event.target.value })}
              >
                <option>CLIENT</option>
                <option>CARRIER</option>
                <option>DRIVER</option>
              </select>
            </label>
            <label>
              Party
              <select
                required
                value={form.partyId}
                onChange={(event) => setForm({ ...form, partyId: event.target.value })}
              >
                <option value="">Select party</option>
                {partyOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name ?? option.plateNo} {option.code ? `· ${option.code}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button" disabled={busy}>
              Create
            </button>
          </form>
        </section>
      ) : null}
      <section className="operations-panel">
        <div className="panel-heading">
          <div>
            <h2>Contract registry</h2>
            <p>{records ? `${records.meta.total} contracts` : 'Loading…'}</p>
          </div>
          <div className="filters">
            <label>
              Search
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label>
              Status
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All</option>
                <option>ACTIVE</option>
                <option>INACTIVE</option>
                <option>EXPIRED</option>
              </select>
            </label>
          </div>
        </div>
        {error ? (
          <div className="state-panel error-state" role="alert">
            {error}
          </div>
        ) : null}
        {records ? (
          <div className="mission-table-wrap">
            <table className="mission-table">
              <thead>
                <tr>
                  <th>Contract</th>
                  <th>Cadence</th>
                  <th>Effective period</th>
                  <th>Parties</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.data.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <strong>{record.name}</strong>
                      <small>{record.code}</small>
                    </td>
                    <td>{record.cadence}</td>
                    <td>
                      <span>{new Date(record.effectiveFrom).toLocaleDateString()}</span>
                      <small>to {new Date(record.effectiveTo).toLocaleDateString()}</small>
                    </td>
                    <td>
                      {record.parties
                        .map((party) => `${party.partyType}: ${party.partyId.slice(0, 8)}`)
                        .join(', ')}
                    </td>
                    <td>{record.status}</td>
                    <td>
                      {hasPermission('contract.manage') && record.status === 'ACTIVE' ? (
                        <button
                          className="mission-view-button danger"
                          disabled={busy}
                          onClick={() => void deactivate(record.id)}
                        >
                          Deactivate
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="state-panel" role="status">
            Loading contracts…
          </div>
        )}
        {records && records.meta.totalPages > 1 ? (
          <div className="pagination">
            <button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>
              Previous
            </button>
            <span>Page {page}</span>
            <button
              disabled={page === records.meta.totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
