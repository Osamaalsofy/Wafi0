'use client';

import { useEffect, useState } from 'react';
import { ApiRequestError, getAuditContext } from '../../lib/api-client';
import type { AuditContextType, AuditEntry } from './types';

export function AuditTimeline({
  accessToken,
  contextType,
  contextId,
  initiallyOpen = false,
}: {
  accessToken: string;
  contextType: AuditContextType;
  contextId: string;
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [entries, setEntries] = useState<AuditEntry[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open || entries) return;
    const controller = new AbortController();
    void getAuditContext(accessToken, contextType, contextId, controller.signal)
      .then(setEntries)
      .catch((cause: unknown) => setError(message(cause)));
    return () => controller.abort();
  }, [accessToken, contextId, contextType, entries, open]);

  return (
    <section className="audit-timeline">
      <button
        className="audit-toggle"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>Audit timeline</span>
        <small>{open ? 'Hide' : 'Review changes'}</small>
      </button>
      {open ? (
        <div className="audit-events">
          {error ? (
            <p className="inline-error" role="alert">
              {error}
            </p>
          ) : null}
          {!entries && !error ? <p className="empty-copy">Loading audit history…</p> : null}
          {entries?.length ? (
            entries.map((entry) => (
              <article key={entry.id}>
                <span className="audit-dot" aria-hidden="true" />
                <div>
                  <strong>{label(entry.action)}</strong>
                  <p>
                    {entry.actor?.name ?? 'System'} · {new Date(entry.createdAt).toLocaleString()}
                  </p>
                  <small>{summary(entry)}</small>
                </div>
              </article>
            ))
          ) : entries ? (
            <p className="empty-copy">No audit records found for this context.</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function label(action: string) {
  return action
    .split('.')
    .map((part) => part.replaceAll('_', ' '))
    .join(' · ');
}

function summary(entry: AuditEntry) {
  const values = entry.newValues;
  if (!values) return `${entry.entityType} ${entry.entityId}`;
  const visible = Object.entries(values)
    .filter(([, value]) => value !== null && typeof value !== 'object')
    .slice(0, 4);
  return visible.length
    ? visible.map(([key, value]) => `${key.replaceAll('_', ' ')}: ${String(value)}`).join(' · ')
    : `${entry.entityType} updated`;
}

function message(cause: unknown) {
  return cause instanceof ApiRequestError || cause instanceof Error
    ? cause.message
    : 'Unable to load audit history';
}
