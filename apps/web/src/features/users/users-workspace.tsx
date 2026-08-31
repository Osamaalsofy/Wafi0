'use client';
import { useEffect, useState, type FormEvent } from 'react';
import {
  ApiRequestError,
  assignUserRole,
  createResource,
  getRoles,
  getUsers,
  updateResource,
  listResource,
} from '../../lib/api-client';
import { useSession } from '../auth/session-provider';
interface User {
  id: string;
  name: string;
  email: string;
  status: 'ACTIVE' | 'INACTIVE';
  lastLoginAt: string | null;
  createdAt: string;
  driver: { id: string; name: string; carrierId: string } | null;
}
interface Role {
  id: string;
  code: string;
  name: string;
}
interface Driver { id: string; name: string; status: string; }
interface Client { id: string; code: string; name: string; }
export function UsersWorkspace({ accessToken }: { accessToken: string }) {
  const { hasPermission, user } = useSession();
  const [users, setUsers] = useState<User[]>();
  const [roles, setRoles] = useState<Role[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [clientForm, setClientForm] = useState({ clientId: '', name: '', email: '', password: '' });
  const [driverForm, setDriverForm] = useState({ driverId: '', name: '', email: '', password: '' });
  const [portalCreated, setPortalCreated] = useState<string>();
  const [driverPortalCreated, setDriverPortalCreated] = useState<string>();
  const [roleByUser, setRoleByUser] = useState<Record<string, string>>({});
  const [driverByUser, setDriverByUser] = useState<Record<string, string>>({});
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      getUsers<User>(accessToken, controller.signal),
      hasPermission('role.read')
        ? getRoles<Role>(accessToken, controller.signal)
        : Promise.resolve([]),
      hasPermission('driver.read')
        ? listResource<Driver>(accessToken, '/drivers', new URLSearchParams({ limit: '100' }), controller.signal)
        : Promise.resolve({ data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 0 } }),
      hasPermission('client.read')
        ? listResource<Client>(accessToken, '/clients', new URLSearchParams({ limit: '100', status: 'ACTIVE' }), controller.signal)
        : Promise.resolve({ data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 0 } }),
    ])
      .then(([nextUsers, nextRoles, nextDrivers, nextClients]) => {
        setUsers(nextUsers);
        setRoles(nextRoles);
        setDrivers(nextDrivers.data);
        setClients(nextClients.data);
        setDriverByUser(Object.fromEntries(nextUsers.map((item) => [item.id, item.driver?.id ?? ''])));
        setError(undefined);
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted)
          setError(
            requestError instanceof ApiRequestError ? requestError.message : 'Unable to load users',
          );
      });
    return () => controller.abort();
  }, [accessToken, hasPermission, revision]);
  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await createResource(accessToken, '/users', form);
      setForm({ name: '', email: '', password: '' });
      setRevision((value) => value + 1);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to create user');
    } finally {
      setBusy(false);
    }
  }
  async function createClientPortalUser(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setPortalCreated(undefined);
    try {
      await createResource(accessToken, '/users/client-portal', clientForm);
      setPortalCreated(clientForm.email);
      setClientForm({ clientId: '', name: '', email: '', password: '' });
      setRevision((value) => value + 1);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to create client portal user');
    } finally {
      setBusy(false);
    }
  }
  async function createDriverPortalUser(event: FormEvent) {
    event.preventDefault(); setBusy(true); setDriverPortalCreated(undefined);
    try {
      await createResource(accessToken, '/users/driver-portal', driverForm);
      setDriverPortalCreated(driverForm.email);
      setDriverForm({ driverId: '', name: '', email: '', password: '' });
      setRevision((value) => value + 1);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to create driver portal user');
    } finally { setBusy(false); }
  }
  async function status(item: User) {
    setBusy(true);
    try {
      await updateResource(accessToken, `/users/${item.id}/status`, {
        status: item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      });
      setRevision((value) => value + 1);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update user');
    } finally {
      setBusy(false);
    }
  }
  async function assign(item: User) {
    const roleId = roleByUser[item.id];
    if (!roleId) return;
    setBusy(true);
    try {
      await assignUserRole(accessToken, item.id, roleId);
      setRevision((value) => value + 1);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to assign role');
    } finally {
      setBusy(false);
    }
  }
  async function linkDriver(item: User) {
    setBusy(true);
    try {
      await updateResource(accessToken, `/users/${item.id}/driver`, {
        driverId: driverByUser[item.id] || null,
      });
      setRevision((value) => value + 1);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to link driver');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="dashboard">
      <header className="topbar">
        <div>
          <p className="eyebrow">ACCESS MANAGEMENT</p>
          <h1>Users</h1>
          <p className="muted">Tenant identities, account status, and organization roles</p>
        </div>
      </header>
      {hasPermission('user.create') ? (
        <section className="operations-panel driver-account-creator">
          <div className="panel-heading"><div><p className="eyebrow">DRIVER ACCESS</p><h2>Create driver portal account</h2><p>Creates a private mobile login linked to one active driver.</p></div><a className="quiet-button" href="/driver" target="_blank" rel="noreferrer">Open driver sign-in</a></div>
          <form className="filters master-form" onSubmit={createDriverPortalUser}>
            <label>Driver<select required value={driverForm.driverId} onChange={(event) => setDriverForm({ ...driverForm, driverId: event.target.value })}><option value="">Select driver</option>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}</select></label>
            <label>Account name<input required minLength={2} value={driverForm.name} onChange={(event) => setDriverForm({ ...driverForm, name: event.target.value })} /></label>
            <label>Login email<input required type="email" value={driverForm.email} onChange={(event) => setDriverForm({ ...driverForm, email: event.target.value })} /></label>
            <label>Initial password<input required type="password" minLength={12} value={driverForm.password} onChange={(event) => setDriverForm({ ...driverForm, password: event.target.value })} /></label>
            <button className="primary-button" disabled={busy || drivers.length === 0}>Create driver login</button>
          </form>
          {driverPortalCreated ? <p className="portal-account-success" role="status">Driver portal account created for {driverPortalCreated}. Sign-in URL: /driver</p> : null}
        </section>
      ) : null}
      {hasPermission('user.create') ? (
        <section className="operations-panel client-account-creator">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">CUSTOMER ACCESS</p>
              <h2>Create client portal account</h2>
              <p>Creates an independent, read-only login restricted to one client.</p>
            </div>
            <a className="quiet-button" href="/portal" target="_blank" rel="noreferrer">Open client sign-in</a>
          </div>
          <form className="filters master-form" onSubmit={createClientPortalUser}>
            <label>
              Client
              <select required value={clientForm.clientId} onChange={(event) => setClientForm({ ...clientForm, clientId: event.target.value })}>
                <option value="">Select client</option>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.name} · {client.code}</option>)}
              </select>
            </label>
            <label>
              Contact name
              <input required minLength={2} value={clientForm.name} onChange={(event) => setClientForm({ ...clientForm, name: event.target.value })} />
            </label>
            <label>
              Login email
              <input required type="email" value={clientForm.email} onChange={(event) => setClientForm({ ...clientForm, email: event.target.value })} />
            </label>
            <label>
              Initial password
              <input required type="password" minLength={12} value={clientForm.password} onChange={(event) => setClientForm({ ...clientForm, password: event.target.value })} />
            </label>
            <button className="primary-button" disabled={busy || clients.length === 0}>Create portal login</button>
          </form>
          {portalCreated ? <p className="portal-account-success" role="status">Portal account created for {portalCreated}. Sign-in URL: /portal</p> : null}
        </section>
      ) : null}
      {hasPermission('user.create') ? (
        <section className="operations-panel compact-panel">
          <div className="panel-heading">
            <div>
              <h2>Create user</h2>
              <p>Creates a real tenant identity</p>
            </div>
          </div>
          <form className="filters master-form" onSubmit={create}>
            <label>
              Name
              <input
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
            <label>
              Email
              <input
                required
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </label>
            <label>
              Initial password
              <input
                required
                type="password"
                minLength={12}
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
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
            <h2>User registry</h2>
            <p>{users ? `${users.length} users` : 'Loading…'}</p>
          </div>
        </div>
        {error ? (
          <div className="state-panel error-state" role="alert">
            {error}
          </div>
        ) : null}
        {users ? (
          <div className="mission-table-wrap">
            <table className="mission-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Status</th>
                  <th>Last login</th>
                  <th>Role assignment</th>
                  <th>Driver identity</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                      <small>{item.email}</small>
                    </td>
                    <td>{item.status}</td>
                    <td>
                      {item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleString() : 'Never'}
                    </td>
                    <td>
                      {hasPermission('user.update') && hasPermission('driver.read') ? (
                        <div className="inline-actions">
                          <select
                            aria-label={`Driver for ${item.name}`}
                            value={driverByUser[item.id] ?? ''}
                            onChange={(event) => setDriverByUser({ ...driverByUser, [item.id]: event.target.value })}
                          >
                            <option value="">No driver</option>
                            {drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}
                          </select>
                          <button disabled={busy} onClick={() => void linkDriver(item)}>Save</button>
                        </div>
                      ) : item.driver?.name ?? 'Not linked'}
                    </td>
                    <td>
                      {hasPermission('user.role.assign') ? (
                        <div className="inline-actions">
                          <select
                            aria-label={`Role for ${item.name}`}
                            value={roleByUser[item.id] ?? ''}
                            onChange={(event) =>
                              setRoleByUser({ ...roleByUser, [item.id]: event.target.value })
                            }
                          >
                            <option value="">Select role</option>
                            {roles.map((role) => (
                              <option key={role.id} value={role.id}>
                                {role.name} · {role.code}
                              </option>
                            ))}
                          </select>
                          <button
                            disabled={busy || !roleByUser[item.id]}
                            onClick={() => void assign(item)}
                          >
                            Assign
                          </button>
                        </div>
                      ) : (
                        'Not permitted'
                      )}
                    </td>
                    <td>
                      {hasPermission('user.update') && item.id !== user?.userId ? (
                        <button
                          className="mission-view-button"
                          disabled={busy}
                          onClick={() => void status(item)}
                        >
                          {item.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
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
            Loading users…
          </div>
        )}
      </section>
    </main>
  );
}
