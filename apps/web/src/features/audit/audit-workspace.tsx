'use client';
import { useEffect, useState } from 'react';
import { ApiRequestError, getAuditLogs } from '../../lib/api-client';
interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorUserId: string | null;
  createdAt: string;
  requestId: string | null;
  oldValues: unknown;
  newValues: unknown;
}
export function AuditWorkspace({ accessToken }: { accessToken: string }) {
  const [logs, setLogs] = useState<AuditLog[]>();
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string>();
  useEffect(() => {
    const controller = new AbortController();
    void getAuditLogs<AuditLog>(accessToken, page, controller.signal)
      .then((response) => {
        setLogs(response);
        setError(undefined);
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted)
          setError(
            requestError instanceof ApiRequestError
              ? requestError.message
              : 'Unable to load audit log',
          );
      });
    return () => controller.abort();
  }, [accessToken, page]);
  return (
    <main className="dashboard">
      <header className="topbar">
        <div>
          <p className="eyebrow">GOVERNANCE</p>
          <h1>Audit</h1>
          <p className="muted">Immutable tenant activity recorded by backend workflows</p>
        </div>
      </header>
      <section className="operations-panel">
        <div className="panel-heading">
          <div>
            <h2>Recent activity</h2>
            <p>Newest entries first</p>
          </div>
        </div>
        {error ? (
          <div className="state-panel error-state" role="alert">
            {error}
          </div>
        ) : null}
        {logs ? (
          <div className="mission-table-wrap">
            <table className="mission-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Actor</th>
                  <th>Request</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.createdAt).toLocaleString()}</td>
                    <td>
                      <strong>{log.action}</strong>
                    </td>
                    <td>
                      <span>{log.entityType}</span>
                      <small>{log.entityId}</small>
                    </td>
                    <td>{log.actorUserId ?? 'System'}</td>
                    <td>{log.requestId ?? '—'}</td>
                    <td>
                      <details>
                        <summary>Inspect</summary>
                        <pre className="audit-json">
                          {JSON.stringify({ old: log.oldValues, new: log.newValues }, null, 2)}
                        </pre>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="state-panel" role="status">
            Loading audit activity…
          </div>
        )}
        {logs ? (
          <div className="pagination">
            <button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>
              Previous
            </button>
            <span>Page {page}</span>
            <button disabled={logs.length < 25} onClick={() => setPage((value) => value + 1)}>
              Next
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
