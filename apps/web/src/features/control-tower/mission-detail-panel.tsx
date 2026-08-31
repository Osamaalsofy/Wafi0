'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ApiRequestError,
  getDocumentContent,
  getMission,
  getMissionDocuments,
  getMissionEvents,
} from '../../lib/api-client';
import type { MissionDetail, MissionDocument, MissionEvent, PaginatedResponse } from './types';
import { formatOperationalTime } from './operational-time';
import { AuditTimeline } from '../audit/audit-timeline';
import { MissionWorkflowActions } from '../missions/mission-workflow-actions';
import { useI18n } from '../../i18n/i18n-provider';
import { translateVisibleText } from '../../i18n/localized-surface';
import { DigitalWaybillView } from '../waybills/digital-waybill';
import { useSession } from '../auth/session-provider';

function humanize(value: string) {
  return value
    .replaceAll('.', ' ')
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatBytes(value: number) {
  return value < 1024 * 1024
    ? `${Math.ceil(value / 1024)} KB`
    : `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function MissionDetailPanel({
  accessToken,
  missionId,
  onClose,
  onChanged,
  enableWorkflow = false,
}: {
  accessToken: string;
  missionId: string;
  onClose: () => void;
  onChanged?: () => void;
  enableWorkflow?: boolean;
}) {
  const { locale } = useI18n();
  const { hasPermission } = useSession();
  const [mission, setMission] = useState<MissionDetail>();
  const [eventPage, setEventPage] = useState<PaginatedResponse<MissionEvent>>();
  const [documentPage, setDocumentPage] = useState<PaginatedResponse<MissionDocument>>();
  const [error, setError] = useState<string>();
  const [retry, setRetry] = useState(0);
  const [downloadingId, setDownloadingId] = useState<string>();
  const [downloadError, setDownloadError] = useState<string>();
  const [eventsLoading, setEventsLoading] = useState(false);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string>();
  const [documentsError, setDocumentsError] = useState<string>();
  const [showWaybill, setShowWaybill] = useState(false);
  const eventRequest = useRef<AbortController | null>(null);
  const documentRequest = useRef<AbortController | null>(null);

  async function loadEventPage(page: number) {
    eventRequest.current?.abort();
    const controller = new AbortController();
    eventRequest.current = controller;
    setEventsLoading(true);
    setEventsError(undefined);
    try {
      setEventPage(await getMissionEvents(accessToken, missionId, page, controller.signal));
    } catch (requestError: unknown) {
      if (!controller.signal.aborted) {
        setEventsError(
          requestError instanceof Error ? requestError.message : 'Unable to load events',
        );
      }
    } finally {
      if (!controller.signal.aborted) setEventsLoading(false);
    }
  }

  async function loadDocumentPage(page: number) {
    documentRequest.current?.abort();
    const controller = new AbortController();
    documentRequest.current = controller;
    setDocumentsLoading(true);
    setDocumentsError(undefined);
    try {
      setDocumentPage(await getMissionDocuments(accessToken, missionId, page, controller.signal));
    } catch (requestError: unknown) {
      if (!controller.signal.aborted) {
        setDocumentsError(
          requestError instanceof Error ? requestError.message : 'Unable to load documents',
        );
      }
    } finally {
      if (!controller.signal.aborted) setDocumentsLoading(false);
    }
  }

  async function downloadDocument(document: MissionDocument) {
    setDownloadingId(document.id);
    setDownloadError(undefined);
    try {
      const content = await getDocumentContent(accessToken, document.id);
      const url = URL.createObjectURL(content);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = document.originalFileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (requestError: unknown) {
      setDownloadError(
        requestError instanceof ApiRequestError
          ? requestError.message
          : 'Unable to download document',
      );
    } finally {
      setDownloadingId(undefined);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    void Promise.all([
      getMission(accessToken, missionId, controller.signal),
      getMissionEvents(accessToken, missionId, 1, controller.signal),
      getMissionDocuments(accessToken, missionId, 1, controller.signal),
    ])
      .then(([missionData, eventData, documentData]) => {
        setMission(missionData);
        setEventPage(eventData);
        setDocumentPage(documentData);
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          requestError instanceof ApiRequestError
            ? requestError.message
            : 'Unable to load mission details',
        );
      });
    return () => {
      controller.abort();
      eventRequest.current?.abort();
      documentRequest.current?.abort();
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [accessToken, missionId, onClose, retry]);

  return (
    <div
      className="detail-overlay"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <aside
        className="detail-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mission-detail-title"
      >
        <header className="detail-header">
          <div>
            <p className="eyebrow">MISSION OPERATIONS</p>
            <h2 id="mission-detail-title">{mission?.missionNo ?? 'Loading mission…'}</h2>
          </div>
          <button
            className="detail-close"
            type="button"
            aria-label="Close mission details"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        {error ? (
          <div className="state-panel error-state" role="alert">
            <strong>Mission details unavailable</strong>
            <span>{error}</span>
            <button
              className="quiet-button"
              onClick={() => {
                setMission(undefined);
                setError(undefined);
                setRetry((value) => value + 1);
              }}
            >
              Try again
            </button>
          </div>
        ) : !mission ? (
          <div className="state-panel">
            <span className="spinner" /> Loading mission history…
          </div>
        ) : (
          <div className="detail-content">
            <section className="detail-section" aria-labelledby="overview-title">
              <div className="detail-section-heading">
                <h3 id="overview-title">Overview</h3>
                <span className={`status-badge status-${mission.status.toLowerCase()}`}>
                  {translateVisibleText(humanize(mission.status), locale)}
                </span>
              </div>
              <dl className="detail-grid">
                <div>
                  <dt>Client</dt>
                  <dd>{mission.client.name}</dd>
                </div>
                <div>
                  <dt>Warehouse</dt>
                  <dd>{mission.warehouse.name}</dd>
                </div>
                <div>
                  <dt>Operational contract</dt>
                  <dd>
                    {mission.contract
                      ? `${mission.contract.name} · ${mission.contract.code} · ${translateVisibleText(humanize(mission.contract.cadence), locale)}`
                      : 'Not assigned'}
                  </dd>
                </div>
                <div>
                  <dt>Route</dt>
                  <dd>
                    {mission.route
                      ? `${mission.route.name} · ${mission.route.cityRegion}`
                      : 'Not assigned'}
                  </dd>
                </div>
                <div>
                  <dt>Carrier</dt>
                  <dd>{mission.carrier?.name ?? 'Unassigned'}</dd>
                </div>
                <div>
                  <dt>Vehicle / driver</dt>
                  <dd>
                    {mission.vehicle?.plateNo ?? 'No vehicle'} ·{' '}
                    {mission.driver?.name ?? 'No driver'}
                  </dd>
                </div>
                <div>
                  <dt>Scheduled loading</dt>
                  <dd>
                    {formatOperationalTime(mission.scheduledLoadingAt, mission.route?.timeZone, locale)}
                  </dd>
                </div>
                <div>
                  <dt>Actual departure</dt>
                  <dd>
                    {formatOperationalTime(mission.actualDepartureAt, mission.route?.timeZone, locale)}
                  </dd>
                </div>
                <div className="wide">
                  <dt>Cargo</dt>
                  <dd>{mission.cargoType ?? 'Not specified'}</dd>
                </div>
                {mission.notes ? (
                  <div className="wide">
                    <dt>Notes</dt>
                    <dd>{mission.notes}</dd>
                  </div>
                ) : null}
              </dl>
            </section>

            {enableWorkflow && onChanged ? (
              <MissionWorkflowActions
                accessToken={accessToken}
                mission={mission}
                onChanged={onChanged}
              />
            ) : null}

            <section className="detail-section" aria-labelledby="stops-title">
              <div className="detail-section-heading">
                <h3 id="stops-title">Stops</h3>
                <span>{mission.stops.length}</span>
              </div>
              {mission.stops.length ? (
                <ol className="stop-list">
                  {mission.stops.map((stop) => (
                    <li key={stop.id}>
                      <span className="stop-sequence">{stop.sequence}</span>
                      <div>
                        <strong>{stop.branch.name}</strong>
                        <small>
                          {stop.branch.code} · Expected{' '}
                          {formatOperationalTime(stop.expectedArrival, mission.route?.timeZone, locale)}
                        </small>
                      </div>
                      <span className="compact-status">{translateVisibleText(humanize(stop.status), locale)}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="empty-copy">No stops have been added.</p>
              )}
            </section>

            <section className="detail-section" aria-labelledby="documents-title">
              <div className="detail-section-heading">
                <h3 id="documents-title">Documents</h3>
                <div><span>{documentPage?.meta.total ?? 0}</span><button className="quiet-button" type="button" onClick={() => setShowWaybill(true)}>Waybill / بوليصة شحن</button></div>
              </div>
              {downloadError ? (
                <p className="inline-error" role="alert">
                  {downloadError}
                </p>
              ) : null}
              {documentsError ? (
                <p className="inline-error" role="alert">
                  {documentsError}
                </p>
              ) : null}
              {documentPage?.data.length ? (
                <ul className="document-list">
                  {documentPage.data.map((item) => (
                    <li key={item.id}>
                      <div>
                        <strong>{translateVisibleText(humanize(item.type), locale)}</strong>
                        <small>
                          {item.originalFileName} · {formatBytes(item.sizeBytes)}
                          {item.stop ? ` · Stop ${item.stop.sequence}` : ''}
                        </small>
                      </div>
                      <div className="document-actions">
                        <span
                          className={`verification verification-${item.verificationStatus.toLowerCase()}`}
                        >
                          {translateVisibleText(humanize(item.verificationStatus), locale)}
                        </span>
                        <button
                          className="document-download"
                          type="button"
                          disabled={Boolean(downloadingId)}
                          onClick={() => void downloadDocument(item)}
                        >
                          {downloadingId === item.id ? 'Downloading…' : 'Download'}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty-copy">No documents uploaded for this mission.</p>
              )}
              {documentPage && documentPage.meta.totalPages > 1 ? (
                <HistoryPagination
                  label="document"
                  loading={documentsLoading}
                  meta={documentPage.meta}
                  onPage={(page) => void loadDocumentPage(page)}
                />
              ) : null}
            </section>

            <section className="detail-section" aria-labelledby="timeline-title">
              <div className="detail-section-heading">
                <h3 id="timeline-title">Event timeline</h3>
                <span>{eventPage?.meta.total ?? 0}</span>
              </div>
              {eventsError ? (
                <p className="inline-error" role="alert">
                  {eventsError}
                </p>
              ) : null}
              {eventPage?.data.length ? (
                <ol className="event-list">
                  {eventPage.data.map((item) => (
                    <li key={item.id}>
                      <span className="event-marker" />
                      <div>
                        <strong>{translateVisibleText(humanize(item.eventType), locale)}</strong>
                        <small>
                          {formatOperationalTime(item.occurredAt, mission.route?.timeZone, locale)} ·{' '}
                          {item.source}
                        </small>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="empty-copy">No mission events recorded.</p>
              )}
              {eventPage && eventPage.meta.totalPages > 1 ? (
                <HistoryPagination
                  label="event"
                  loading={eventsLoading}
                  meta={eventPage.meta}
                  onPage={(page) => void loadEventPage(page)}
                />
              ) : null}
            </section>
            <AuditTimeline accessToken={accessToken} contextType="MISSION" contextId={mission.id} />
          </div>
        )}
      </aside>
      {showWaybill ? <DigitalWaybillView accessToken={accessToken} missionId={missionId} canManage={hasPermission('document.upload')} onClose={() => setShowWaybill(false)} /> : null}
    </div>
  );
}

function HistoryPagination({
  label,
  loading,
  meta,
  onPage,
}: {
  label: 'event' | 'document';
  loading: boolean;
  meta: { page: number; totalPages: number };
  onPage: (page: number) => void;
}) {
  return (
    <div className="history-pagination">
      <button
        type="button"
        aria-label={`Previous ${label} page`}
        disabled={loading || meta.page <= 1}
        onClick={() => onPage(meta.page - 1)}
      >
        Previous
      </button>
      <span>
        Page {meta.page} of {meta.totalPages}
      </span>
      <button
        type="button"
        aria-label={`Next ${label} page`}
        disabled={loading || meta.page >= meta.totalPages}
        onClick={() => onPage(meta.page + 1)}
      >
        {loading ? 'Loading…' : 'Next'}
      </button>
    </div>
  );
}
