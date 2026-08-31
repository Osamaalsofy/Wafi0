'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { ApiRequestError, createResource, listResource } from '../../lib/api-client';
import { useSession } from '../auth/session-provider';
interface RouteRecord {
  id: string;
  code: string;
  name: string;
  cityRegion: string;
  timeZone: string;
  status: string;
  client: { name: string };
  stops: Array<{ sequence: number; branch: { name: string } }>;
}
interface EntityOption {
  id: string;
  code: string;
  name: string;
}
export function RoutesWorkspace({ accessToken }: { accessToken: string }) {
  const { hasPermission } = useSession();
  const [records, setRecords] = useState<{ data: RouteRecord[]; meta: { total: number } }>();
  const [form, setForm] = useState({
    clientId: '',
    code: '',
    name: '',
    cityRegion: '',
    timeZone: 'Asia/Riyadh',
  });
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [clients, setClients] = useState<EntityOption[]>([]);
  const [branches, setBranches] = useState<EntityOption[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    void listResource<EntityOption>(
      accessToken,
      '/clients',
      new URLSearchParams({ page: '1', limit: '100', status: 'ACTIVE' }),
      controller.signal,
    )
      .then((response) => {
        if (!controller.signal.aborted) setClients(response.data);
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted)
          setError(
            requestError instanceof ApiRequestError
              ? requestError.message
              : 'Unable to load clients',
          );
      });
    return () => controller.abort();
  }, [accessToken]);
  useEffect(() => {
    if (!form.clientId) return;
    const controller = new AbortController();
    void listResource<EntityOption>(
      accessToken,
      '/branches',
      new URLSearchParams({ page: '1', limit: '100', status: 'ACTIVE', clientId: form.clientId }),
      controller.signal,
    )
      .then((response) => {
        if (!controller.signal.aborted) setBranches(response.data);
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted)
          setError(
            requestError instanceof ApiRequestError
              ? requestError.message
              : 'Unable to load branches',
          );
      });
    return () => controller.abort();
  }, [accessToken, form.clientId]);
  useEffect(() => {
    const controller = new AbortController();
    void listResource<RouteRecord>(
      accessToken,
      '/routes',
      new URLSearchParams({ page: '1', limit: '100' }),
      controller.signal,
    )
      .then((response) => {
        setRecords(response);
        setError(undefined);
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted)
          setError(
            requestError instanceof ApiRequestError
              ? requestError.message
              : 'Unable to load routes',
          );
      });
    return () => controller.abort();
  }, [accessToken, revision]);
  async function create(event: FormEvent) {
    event.preventDefault();
    const code = form.code.trim().toUpperCase();
    const name = form.name.trim();
    const cityRegion = form.cityRegion.trim();
    if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(code)) {
      setError('رمز المسار يجب أن يحتوي على أحرف إنجليزية وأرقام وشرطة فقط.');
      return;
    }
    if (code.length < 2 || name.length < 2 || cityRegion.length < 2) {
      setError('يجب ألا يقل رمز المسار واسمه والمدينة أو المنطقة عن حرفين.');
      return;
    }
    if (!form.clientId || !selectedBranchIds.length) {
      setError('اختر العميل وأضف فرعًا واحدًا على الأقل إلى ترتيب المسار.');
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const stops = selectedBranchIds.map((branchId, index) => ({
        branchId,
        sequence: index + 1,
      }));
      await createResource(accessToken, '/routes', {
        ...form,
        code,
        name,
        cityRegion,
        timeZone: form.timeZone.trim(),
        stops,
      });
      setForm({ ...form, code: '', name: '' });
      setSelectedBranchIds([]);
      setRevision((value) => value + 1);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to create route');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="dashboard">
      <header className="topbar">
        <div>
          <p className="eyebrow">NETWORK DESIGN</p>
          <h1>Routes</h1>
          <p className="muted">Client route definitions with deterministic branch sequences</p>
        </div>
      </header>
      {hasPermission('route.manage') ? (
        <section className="operations-panel compact-panel">
          <div className="panel-heading">
            <div>
              <h2>Create route</h2>
              <p>Select branches in delivery order</p>
            </div>
          </div>
          <form className="master-form routes-form" onSubmit={create}>
            <label>
              Client
              <select
                required
                value={form.clientId}
                onChange={(event) => {
                  setForm({ ...form, clientId: event.target.value });
                  setSelectedBranchIds([]);
                  setBranches([]);
                }}
              >
                <option value="">Select client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} · {client.code}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Code
              <input
                required
                minLength={2}
                maxLength={80}
                pattern="[A-Za-z0-9][A-Za-z0-9_-]*"
                title="استخدم الأحرف الإنجليزية والأرقام والشرطة فقط"
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
              />
            </label>
            <label>
              Name
              <input
                required
                minLength={2}
                maxLength={160}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
            <label>
              City / region
              <input
                required
                minLength={2}
                maxLength={160}
                value={form.cityRegion}
                onChange={(event) => setForm({ ...form, cityRegion: event.target.value })}
              />
            </label>
            <label>
              Time zone
              <input
                required
                value={form.timeZone}
                onChange={(event) => setForm({ ...form, timeZone: event.target.value })}
              />
            </label>
            <div className="route-branch-order">
              <label>
                Add branch
                <select
                  value=""
                  disabled={!form.clientId || branches.length === selectedBranchIds.length}
                  onChange={(event) => {
                    if (!event.target.value) return;
                    setSelectedBranchIds([...selectedBranchIds, event.target.value]);
                  }}
                >
                  <option value="">
                    {!form.clientId ? 'Select a client first' : 'Select branch'}
                  </option>
                  {branches
                    .filter((branch) => !selectedBranchIds.includes(branch.id))
                    .map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name} · {branch.code}
                      </option>
                    ))}
                </select>
              </label>
              <ol className="route-stop-order" aria-label="Ordered route branches">
                {selectedBranchIds.map((branchId, index) => {
                  const branch = branches.find((item) => item.id === branchId);
                  return (
                    <li key={branchId}>
                      <span className="route-stop-sequence">{index + 1}</span>
                      <span>
                        <strong>{branch?.name}</strong>
                        <small>{branch?.code}</small>
                      </span>
                      <div className="route-stop-actions">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => {
                            const next = [...selectedBranchIds];
                            [next[index - 1], next[index]] = [next[index], next[index - 1]];
                            setSelectedBranchIds(next);
                          }}
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          disabled={index === selectedBranchIds.length - 1}
                          onClick={() => {
                            const next = [...selectedBranchIds];
                            [next[index], next[index + 1]] = [next[index + 1], next[index]];
                            setSelectedBranchIds(next);
                          }}
                        >
                          Down
                        </button>
                        <button
                          type="button"
                          className="danger"
                          onClick={() =>
                            setSelectedBranchIds(
                              selectedBranchIds.filter((item) => item !== branchId),
                            )
                          }
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
              {!selectedBranchIds.length ? (
                <p className="route-order-empty">Add at least one branch in delivery order.</p>
              ) : null}
            </div>
            <button className="primary-button" disabled={busy || !selectedBranchIds.length}>
              Create
            </button>
          </form>
        </section>
      ) : null}
      <section className="operations-panel">
        <div className="panel-heading">
          <div>
            <h2>Route registry</h2>
            <p>{records ? `${records.meta.total} routes` : 'Loading…'}</p>
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
                  <th>Route</th>
                  <th>Client</th>
                  <th>Region</th>
                  <th>Time zone</th>
                  <th>Stops</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {records.data.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <strong>{record.name}</strong>
                      <small>{record.code}</small>
                    </td>
                    <td>{record.client.name}</td>
                    <td>{record.cityRegion}</td>
                    <td>{record.timeZone}</td>
                    <td>
                      {record.stops
                        .map((stop) => `${stop.sequence}. ${stop.branch.name}`)
                        .join(' → ')}
                    </td>
                    <td>{record.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="state-panel" role="status">
            Loading routes…
          </div>
        )}
      </section>
    </main>
  );
}
