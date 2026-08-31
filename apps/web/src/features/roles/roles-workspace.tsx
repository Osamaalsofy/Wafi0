'use client';
import { useEffect, useState, type FormEvent } from 'react';
import {
  ApiRequestError,
  createResource,
  getPermissions,
  getRoles,
  updateResource,
} from '../../lib/api-client';
import { useSession } from '../auth/session-provider';
interface Permission {
  id: string;
  code: string;
  description: string;
}
interface Role {
  id: string;
  code: string;
  name: string;
  isSystem: boolean;
  permissions: Array<{ permission: Permission }>;
}
export function RolesWorkspace({ accessToken }: { accessToken: string }) {
  const { hasPermission } = useSession();
  const [roles, setRoles] = useState<Role[]>();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [form, setForm] = useState({ code: '', name: '', permissionCodes: [] as string[] });
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      getRoles<Role>(accessToken, controller.signal),
      getPermissions<Permission>(accessToken, controller.signal),
    ])
      .then(([nextRoles, nextPermissions]) => {
        setRoles(nextRoles);
        setPermissions(nextPermissions);
        setError(undefined);
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted)
          setError(
            requestError instanceof ApiRequestError ? requestError.message : 'Unable to load roles',
          );
      });
    return () => controller.abort();
  }, [accessToken, revision]);
  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await createResource(accessToken, '/roles', form);
      setForm({ code: '', name: '', permissionCodes: [] });
      setRevision((value) => value + 1);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to create role');
    } finally {
      setBusy(false);
    }
  }
  async function replace(role: Role) {
    const selected = window.prompt(
      'Comma-separated permission codes',
      role.permissions.map(({ permission }) => permission.code).join(', '),
    );
    if (selected === null) return;
    setBusy(true);
    try {
      await updateResource(accessToken, `/roles/${role.id}/permissions`, {
        permissionCodes: selected
          .split(',')
          .map((code) => code.trim())
          .filter(Boolean),
      });
      setRevision((value) => value + 1);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Unable to update permissions',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="dashboard">
      <header className="topbar">
        <div>
          <p className="eyebrow">ACCESS MANAGEMENT</p>
          <h1>Roles & permissions</h1>
          <p className="muted">Real backend roles and grant definitions</p>
        </div>
      </header>
      {hasPermission('role.create') ? (
        <section className="operations-panel compact-panel">
          <div className="panel-heading">
            <div>
              <h2>Create role</h2>
              <p>Select the exact backend permissions granted by this role</p>
            </div>
          </div>
          <form className="master-form" onSubmit={create}>
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
            <fieldset className="permission-grid">
              <legend>Permissions</legend>
              {permissions.map((permission) => (
                <label key={permission.id}>
                  <input
                    type="checkbox"
                    checked={form.permissionCodes.includes(permission.code)}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        permissionCodes: event.target.checked
                          ? [...form.permissionCodes, permission.code]
                          : form.permissionCodes.filter((code) => code !== permission.code),
                      })
                    }
                  />
                  {permission.code}
                  <small>{permission.description}</small>
                </label>
              ))}
            </fieldset>
            <button className="primary-button" disabled={busy}>
              Create role
            </button>
          </form>
        </section>
      ) : null}
      <section className="operations-panel">
        <div className="panel-heading">
          <div>
            <h2>Role registry</h2>
            <p>{roles ? `${roles.length} roles` : 'Loading…'}</p>
          </div>
        </div>
        {error ? (
          <div className="state-panel error-state" role="alert">
            {error}
          </div>
        ) : null}
        {roles ? (
          <div className="role-grid">
            {roles.map((role) => (
              <article className="metric-card" key={role.id}>
                <span>{role.isSystem ? 'System role' : 'Custom role'}</span>
                <h3>{role.name}</h3>
                <small>{role.code}</small>
                <p>
                  {role.permissions.map(({ permission }) => permission.code).join(', ') ||
                    'No permissions'}
                </p>
                {hasPermission('role.update') && !role.isSystem ? (
                  <button
                    className="mission-view-button"
                    disabled={busy}
                    onClick={() => void replace(role)}
                  >
                    Replace permissions
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="state-panel" role="status">
            Loading roles…
          </div>
        )}
      </section>
    </main>
  );
}
