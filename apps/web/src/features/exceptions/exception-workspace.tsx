'use client';

import { FormEvent, useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  addCorrectiveAction,
  addExceptionDecision,
  addExceptionRootCause,
  ApiRequestError,
  assignException,
  attachExceptionEvidence,
  changeExceptionSeverity,
  completeCorrectiveAction,
  getException,
  getExceptions,
  getCollection,
  getDocuments,
  getUsers,
  recoverRouteDeviation,
  resolveException,
} from '../../lib/api-client';
import type { ExceptionSeverity, OperationalExceptionDetail, PaginatedExceptions } from './types';
import { AuditTimeline } from '../audit/audit-timeline';
import { useSession } from '../auth/session-provider';
import type { DocumentRecord } from '../documents/types';

interface UserOption {
  id: string;
  name: string;
  email: string;
  status: string;
}
interface RootCauseOption {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  isActive: boolean;
}

const SEVERITIES: ExceptionSeverity[] = ['INFO', 'WARNING', 'HIGH', 'CRITICAL'];

export function ExceptionWorkspace({
  accessToken,
  initialExceptionId,
  onClose = () => undefined,
}: {
  accessToken: string;
  initialExceptionId?: string;
  onClose?: () => void;
}) {
  const { hasPermission } = useSession();
  const [list, setList] = useState<PaginatedExceptions>();
  const [selectedId, setSelectedId] = useState(initialExceptionId);
  const [detail, setDetail] = useState<OperationalExceptionDetail>();
  const [status, setStatus] = useState<'OPEN' | 'RESOLVED'>('OPEN');
  const [severity, setSeverity] = useState('');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [revision, setRevision] = useState(0);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [categories, setCategories] = useState<RootCauseOption[]>([]);

  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ page: String(page), limit: '25', status });
    if (severity) query.set('severity', severity);
    void getExceptions(accessToken, query, controller.signal)
      .then((response) => {
        setList(response);
        setSelectedId((current) => current ?? response.data[0]?.id);
      })
      .catch((cause: unknown) => setError(message(cause)))
      .finally(() => setBusy(false));
    return () => controller.abort();
  }, [accessToken, page, revision, severity, status]);

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    void getException(accessToken, selectedId, controller.signal)
      .then(setDetail)
      .catch((cause: unknown) => setError(message(cause)));
    return () => controller.abort();
  }, [accessToken, revision, selectedId]);

  useEffect(() => {
    if (!detail) return;
    const controller = new AbortController();
    void Promise.all([
      hasPermission('user.read')
        ? getUsers<UserOption>(accessToken, controller.signal)
        : Promise.resolve([]),
      hasPermission('document.read')
        ? getDocuments(
            accessToken,
            new URLSearchParams({ missionId: detail.mission.id, page: '1', limit: '100' }),
            controller.signal,
          ).then((page) => page.data)
        : Promise.resolve([]),
      getCollection<RootCauseOption>(accessToken, '/root-cause-categories', controller.signal),
    ])
      .then(([nextUsers, nextDocuments, nextCategories]) => {
        setUsers(nextUsers.filter((item) => item.status === 'ACTIVE'));
        setDocuments(nextDocuments);
        setCategories(nextCategories.filter((item) => item.isActive));
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(message(cause));
      });
    return () => controller.abort();
  }, [accessToken, detail, hasPermission]);

  async function mutate(operation: () => Promise<unknown>) {
    setBusy(true);
    setError(undefined);
    try {
      await operation();
      refresh();
      return true;
    } catch (cause) {
      setError(message(cause));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="workspace-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Exception workspace"
    >
      <section className="exception-workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">OPERATIONAL INTELLIGENCE</p>
            <h2>Exception workspace</h2>
            <p>Trace the rule, operational facts, responsibility, decision, and action.</p>
          </div>
          <button className="quiet-button" onClick={onClose}>
            Close
          </button>
        </header>

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="exception-layout">
          <aside className="exception-list" aria-label="Exceptions">
            <div className="exception-filters">
              <select
                aria-label="Exception status"
                value={status}
                onChange={(event) => {
                  setPage(1);
                  setStatus(event.target.value as 'OPEN' | 'RESOLVED');
                }}
              >
                <option value="OPEN">Open</option>
                <option value="RESOLVED">Resolved</option>
              </select>
              <select
                aria-label="Exception severity"
                value={severity}
                onChange={(event) => {
                  setPage(1);
                  setSeverity(event.target.value);
                }}
              >
                <option value="">All severities</option>
                {SEVERITIES.map((item) => (
                  <option value={item} key={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            {list?.data.length ? (
              list.data.map((item) => (
                <button
                  className={`exception-list-item ${selectedId === item.id ? 'selected' : ''}`}
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                >
                  <span>
                    <strong>{item.definition.name}</strong>
                    <small>
                      {item.mission.missionNo}
                      {item.stop ? ` · Stop ${item.stop.sequence}` : ''}
                    </small>
                  </span>
                  <SeverityBadge severity={item.severity} />
                </button>
              ))
            ) : (
              <p className="empty-copy">No matching exceptions.</p>
            )}
            {list && list.meta.totalPages > 1 ? (
              <div className="pagination compact">
                <button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>
                  Previous
                </button>
                <span>
                  {page}/{list.meta.totalPages}
                </span>
                <button
                  disabled={page === list.meta.totalPages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </button>
              </div>
            ) : null}
          </aside>

          <main className="exception-detail">
            {!detail ? (
              <p className="empty-copy">Select an exception to inspect it.</p>
            ) : (
              <>
                <section className="exception-title">
                  <div>
                    <span className="status-pill">{detail.status}</span>
                    <h3>{detail.definition.name}</h3>
                    <p>
                      {detail.mission.missionNo} · {detail.ruleCode}
                    </p>
                  </div>
                  <SeverityBadge severity={detail.severity} />
                </section>

                <section className="fact-grid" aria-label="Exception facts">
                  {detail.ruleCode === 'ROUTE_DEVIATION' ? (
                    <>
                      <Fact label="Route ID" value={detail.routeId ?? '—'} />
                      <Fact
                        label="Deviation started"
                        value={formatDate(
                          contextDate(detail.context, 'deviationStartedAt') ?? detail.openedAt,
                        )}
                      />
                      <Fact
                        label="Returned to route"
                        value={formatDate(
                          contextDate(detail.context, 'returnedToRouteAt') ?? detail.resolvedAt,
                        )}
                      />
                      <Fact
                        label="Time outside route"
                        value={
                          detail.delayMinutes === null
                            ? 'In progress'
                            : `${detail.delayMinutes} min`
                        }
                      />
                    </>
                  ) : (
                    <>
                      <Fact
                        label="Delay"
                        value={
                          detail.delayMinutes === null
                            ? 'Not calculated'
                            : `${detail.delayMinutes} min`
                        }
                      />
                      <Fact label="Scheduled (UTC)" value={formatDate(detail.scheduledAt)} />
                      <Fact label="Actual (UTC)" value={formatDate(detail.actualAt)} />
                    </>
                  )}
                  <Fact label="Quantity" value={detail.actualQuantity ?? '—'} />
                  <Fact label="Owner" value={detail.owner?.name ?? 'Unassigned'} />
                  <Fact
                    label="Behavior"
                    value={detail.isBlocking ? 'Configured blocking' : 'Operational warning'}
                  />
                </section>

                {detail.ruleCode === 'ROUTE_DEVIATION' && detail.status === 'OPEN' ? (
                  <form
                    className="inline-actions route-recovery"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const returnedAt = String(
                        new FormData(event.currentTarget).get('returnedAt'),
                      );
                      void mutate(() =>
                        recoverRouteDeviation(
                          accessToken,
                          detail.mission.id,
                          detail.id,
                          new Date(returnedAt).toISOString(),
                        ),
                      );
                    }}
                  >
                    <label>
                      Returned to route
                      <input name="returnedAt" type="datetime-local" required />
                    </label>
                    <button className="primary-button" disabled={busy}>
                      Record recovery
                    </button>
                  </form>
                ) : null}

                {detail.status === 'OPEN' ? (
                  <section className="workflow-grid">
                    <WorkflowForm
                      title="Assign owner"
                      submit="Save owner"
                      busy={busy}
                      fields={
                        <select
                          name="ownerUserId"
                          aria-label="Owner user"
                          disabled={!hasPermission('user.read')}
                          defaultValue={detail.owner?.id ?? ''}
                        >
                          <option value="">Unassigned</option>
                          {users.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.name} · {user.email}
                            </option>
                          ))}
                        </select>
                      }
                      onSubmit={(form) =>
                        mutate(() =>
                          assignException(
                            accessToken,
                            detail.id,
                            textField(form, 'ownerUserId') || undefined,
                          ),
                        )
                      }
                    />
                    <WorkflowForm
                      title="Set severity"
                      submit="Save severity"
                      busy={busy}
                      fields={
                        <select
                          name="severity"
                          aria-label="Severity"
                          defaultValue={detail.severity ?? ''}
                        >
                          <option value="">Unspecified</option>
                          {SEVERITIES.map((item) => (
                            <option key={item}>{item}</option>
                          ))}
                        </select>
                      }
                      onSubmit={(form) =>
                        mutate(() =>
                          changeExceptionSeverity(
                            accessToken,
                            detail.id,
                            textField(form, 'severity') || undefined,
                          ),
                        )
                      }
                    />
                    <WorkflowForm
                      title="Root cause"
                      submit="Add root cause"
                      busy={busy}
                      fields={
                        <>
                          <select required name="category" defaultValue="">
                            <option value="" disabled>
                              Select root cause
                            </option>
                            {categories.map((item) => (
                              <option key={item.id} value={item.code}>
                                {item.nameEn} · {item.nameAr}
                              </option>
                            ))}
                          </select>
                          <textarea
                            required
                            name="description"
                            placeholder="Observed cause and supporting context"
                          />
                          <label className="check-field">
                            <input type="checkbox" name="confirmed" /> Confirmed
                          </label>
                        </>
                      }
                      onSubmit={(form) =>
                        mutate(() =>
                          addExceptionRootCause(accessToken, detail.id, {
                            category: textField(form, 'category'),
                            description: textField(form, 'description'),
                            confirmed: form.get('confirmed') === 'on',
                          }),
                        )
                      }
                    />
                    <WorkflowForm
                      title="Decision"
                      submit="Record decision"
                      busy={busy}
                      fields={
                        <textarea
                          required
                          name="decisionText"
                          placeholder="Decision and rationale"
                        />
                      }
                      onSubmit={(form) =>
                        mutate(() =>
                          addExceptionDecision(
                            accessToken,
                            detail.id,
                            textField(form, 'decisionText'),
                          ),
                        )
                      }
                    />
                    <WorkflowForm
                      title="Supporting evidence"
                      submit="Attach document"
                      busy={busy}
                      fields={
                        <>
                          <select
                            required
                            name="documentId"
                            defaultValue=""
                            disabled={!hasPermission('document.read')}
                          >
                            <option value="" disabled>
                              Select mission document
                            </option>
                            {documents.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.type} · {item.originalFileName} · {item.verificationStatus}
                              </option>
                            ))}
                          </select>
                          <input name="purpose" placeholder="Evidence purpose (optional)" />
                        </>
                      }
                      onSubmit={(form) =>
                        mutate(() =>
                          attachExceptionEvidence(accessToken, detail.id, {
                            documentId: textField(form, 'documentId'),
                            purpose: textField(form, 'purpose') || undefined,
                          }),
                        )
                      }
                    />
                    <WorkflowForm
                      title="Resolve"
                      submit="Resolve exception"
                      busy={busy}
                      danger
                      fields={
                        <textarea
                          required
                          name="notes"
                          placeholder="Resolution evidence and outcome"
                        />
                      }
                      onSubmit={(form) =>
                        mutate(() =>
                          resolveException(accessToken, detail.id, textField(form, 'notes')),
                        )
                      }
                    />
                  </section>
                ) : (
                  <p className="resolution-note">
                    <strong>Resolution:</strong> {detail.resolutionNotes}
                  </p>
                )}

                <Traceability
                  detail={detail}
                  busy={busy}
                  mutate={mutate}
                  accessToken={accessToken}
                  users={users}
                />
                <AuditTimeline
                  accessToken={accessToken}
                  contextType="EXCEPTION"
                  contextId={detail.id}
                  initiallyOpen
                />
              </>
            )}
          </main>
        </div>
      </section>
    </div>
  );
}

function Traceability({
  detail,
  busy,
  mutate,
  accessToken,
  users,
}: {
  detail: OperationalExceptionDetail;
  busy: boolean;
  mutate: (operation: () => Promise<unknown>) => Promise<boolean>;
  accessToken: string;
  users: UserOption[];
}) {
  return (
    <section className="traceability">
      <h3>Traceability</h3>
      <div className="trace-columns">
        <div>
          <h4>Root causes</h4>
          {detail.rootCauses.map((item) => (
            <article key={item.id}>
              <strong>{item.category}</strong>
              <p>{item.description}</p>
              <small>
                {item.confirmedAt
                  ? `Confirmed by ${item.confirmedBy?.name ?? 'user'}`
                  : 'Unconfirmed'}
              </small>
            </article>
          ))}
        </div>
        <div>
          <h4>Evidence</h4>
          {detail.evidence.map((item) => (
            <article key={item.document.id}>
              <strong>{item.document.type}</strong>
              <p>{item.document.originalFileName}</p>
              <small>{item.purpose ?? item.document.verificationStatus}</small>
            </article>
          ))}
        </div>
        <div>
          <h4>Decisions and actions</h4>
          {detail.decisions.map((decision) => (
            <article key={decision.id}>
              <strong>{decision.decisionText}</strong>
              <small>
                {decision.decidedBy.name} · {formatDate(decision.decidedAt)}
              </small>
              {decision.actions.map((action) => (
                <div className="action-row" key={action.id}>
                  <span>
                    {action.actionText} · {action.owner.name}
                  </span>
                  {action.status === 'OPEN' ? (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void mutate(() => completeCorrectiveAction(accessToken, action.id))
                      }
                    >
                      Complete
                    </button>
                  ) : (
                    <small>Completed</small>
                  )}
                </div>
              ))}
              <WorkflowForm
                compact
                title="Add corrective action"
                submit="Add"
                busy={busy}
                fields={
                  <>
                    <select required name="ownerUserId" defaultValue="">
                      <option value="" disabled>
                        Select action owner
                      </option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} · {user.email}
                        </option>
                      ))}
                    </select>
                    <input required name="actionText" placeholder="Corrective action" />
                    <input name="dueAt" type="datetime-local" />
                  </>
                }
                onSubmit={(form) =>
                  mutate(() =>
                    addCorrectiveAction(accessToken, decision.id, {
                      ownerUserId: textField(form, 'ownerUserId'),
                      actionText: textField(form, 'actionText'),
                      dueAt: localDate(form, 'dueAt'),
                    }),
                  )
                }
              />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function WorkflowForm({
  title,
  submit,
  fields,
  onSubmit,
  busy,
  danger = false,
  compact = false,
}: {
  title: string;
  submit: string;
  fields: ReactNode;
  onSubmit: (form: FormData) => Promise<boolean>;
  busy: boolean;
  danger?: boolean;
  compact?: boolean;
}) {
  return (
    <form
      className={`workflow-card ${compact ? 'compact' : ''}`}
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = event.currentTarget;
        void onSubmit(new FormData(form)).then((succeeded) => {
          if (succeeded) form.reset();
        });
      }}
    >
      <h4>{title}</h4>
      {fields}
      <button disabled={busy} className={danger ? 'danger-button' : 'filter-button'} type="submit">
        {submit}
      </button>
    </form>
  );
}

function SeverityBadge({ severity }: { severity: ExceptionSeverity | null }) {
  return (
    <span className={`severity-badge ${severity?.toLowerCase() ?? 'unset'}`}>
      {severity ?? 'UNSET'}
    </span>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function textField(form: FormData, name: string) {
  return String(form.get(name) ?? '').trim();
}
function localDate(form: FormData, name: string) {
  const value = textField(form, name);
  return value ? new Date(value).toISOString() : undefined;
}
function formatDate(value: string | null) {
  return value
    ? new Date(value).toLocaleString([], { timeZone: 'UTC', timeZoneName: 'short' })
    : 'Missing';
}
function message(cause: unknown) {
  return cause instanceof ApiRequestError || cause instanceof Error
    ? cause.message
    : 'Request failed';
}

function contextDate(context: Record<string, unknown>, key: string) {
  const value = context[key];
  return typeof value === 'string' ? value : null;
}
