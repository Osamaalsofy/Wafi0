'use client';

import { useEffect, useState } from 'react';
import { ApiRequestError, getAlerts, markAlertRead } from '../../lib/api-client';
import type { PaginatedAlerts } from './types';
import { AuditTimeline } from '../audit/audit-timeline';
import { useI18n } from '../../i18n/i18n-provider';
import { translateVisibleText } from '../../i18n/localized-surface';

export function AlertsWorkspace({
  accessToken,
  onClose = () => undefined,
  onOpenException = () => undefined,
}: {
  accessToken: string;
  onClose?: () => void;
  onOpenException?: (exceptionId: string) => void;
}) {
  const { locale } = useI18n();
  const [alerts, setAlerts] = useState<PaginatedAlerts>();
  const [unreadOnly, setUnreadOnly] = useState(true);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ page: String(page), limit: '25' });
    if (unreadOnly) query.set('unreadOnly', 'true');
    void getAlerts(accessToken, query, controller.signal)
      .then(setAlerts)
      .catch((cause: unknown) => setError(message(cause)));
    return () => controller.abort();
  }, [accessToken, page, revision, unreadOnly]);

  async function read(id: string) {
    setBusyId(id);
    setError(undefined);
    try {
      await markAlertRead(accessToken, id);
      setRevision((value) => value + 1);
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusyId(undefined);
    }
  }

  return (
    <div className="workspace-overlay" role="dialog" aria-modal="true" aria-label="Alerts">
      <section className="alerts-workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">OPERATIONAL ALERTS</p>
            <h2>Alerts</h2>
            <p>In-app visibility for rule-generated operational conditions.</p>
          </div>
          <button className="quiet-button" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="alerts-toolbar">
          <div>
            <strong>{alerts?.summary.unread ?? 0}</strong>
            <span>Unread tenant alerts</span>
          </div>
          <label className="check-field">
            <input
              checked={unreadOnly}
              onChange={(event) => {
                setPage(1);
                setUnreadOnly(event.target.checked);
              }}
              type="checkbox"
            />{' '}
            Unread only
          </label>
        </div>
        {error ? (
          <p className="form-error workspace-message" role="alert">
            {error}
          </p>
        ) : null}

        <div className="alerts-list">
          {alerts?.data.length ? (
            alerts.data.map((alert) => (
              <article className={alert.readAt ? 'read' : 'unread'} key={alert.id}>
                <div className="alert-marker" aria-hidden="true" />
                <div className="alert-copy">
                  <div>
                    <strong>{translateVisibleText(alert.exception.definition.name, locale)}</strong>
                    <span
                      className={`severity-badge ${alert.exception.severity?.toLowerCase() ?? 'unset'}`}
                    >
                      {translateVisibleText(alert.exception.severity ?? 'UNSET', locale)}
                    </span>
                  </div>
                  <p>
                    {alert.exception.mission.missionNo}
                    {alert.exception.stop ? ` · Stop ${alert.exception.stop.sequence}` : ''} ·{' '}
                    {fact(alert.exception.delayMinutes, alert.exception.actualQuantity)}
                  </p>
                  <small>
                    {new Date(alert.createdAt).toLocaleString(locale)} · {translateVisibleText(alert.channel, locale)}
                  </small>
                  <small>
                    Email delivery · {translateVisibleText(alert.status, locale)} · {alert.deliveryAttempts.length}/2 attempts
                  </small>
                  {alert.deliveryAttempts.at(-1)?.nextAttemptAt ? (
                    <small>
                      Retry due{' '}
                      {new Date(alert.deliveryAttempts.at(-1)!.nextAttemptAt!).toLocaleString(locale)}
                    </small>
                  ) : null}
                  {alert.escalatedAt ? (
                    <small>
                      Escalated to{' '}
                      {alert.escalations.length
                        ? alert.escalations.map(({ recipient }) => recipient.name).join(', ')
                        : 'Fleet Manager'}
                    </small>
                  ) : (
                    <small>Escalation due {new Date(alert.escalationDueAt).toLocaleString(locale)}</small>
                  )}
                  <AuditTimeline
                    accessToken={accessToken}
                    contextType="ALERT"
                    contextId={alert.id}
                  />
                </div>
                <div className="alert-actions">
                  {!alert.readAt ? (
                    <button
                      className="quiet-button"
                      disabled={busyId === alert.id}
                      onClick={() => void read(alert.id)}
                    >
                      {busyId === alert.id ? 'Saving…' : 'Mark read'}
                    </button>
                  ) : (
                    <span>Read</span>
                  )}
                  <button
                    className="filter-button"
                    onClick={() => onOpenException(alert.exceptionId)}
                  >
                    Open exception
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="state-panel">
              <strong>No matching alerts</strong>
              <span>{unreadOnly ? 'All caught up.' : 'No alerts have been generated.'}</span>
            </div>
          )}
        </div>

        {alerts && alerts.meta.totalPages > 1 ? (
          <div className="pagination">
            <button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>
              Previous
            </button>
            <span>
              Page {page} of {alerts.meta.totalPages}
            </span>
            <button
              disabled={page === alerts.meta.totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function fact(delay: number | null, quantity: string | null) {
  if (delay !== null) return `${delay} minute delay`;
  if (quantity !== null) return `Quantity ${quantity}`;
  return 'Operational data requires attention';
}

function message(cause: unknown) {
  return cause instanceof ApiRequestError || cause instanceof Error
    ? cause.message
    : 'Request failed';
}
