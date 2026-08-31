'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  ApiRequestError,
  getDocumentContent,
  getDocuments,
  getMission,
  getMissions,
  uploadDocument,
  verifyDocument,
} from '../../lib/api-client';
import { useSession } from '../auth/session-provider';
import type { PaginatedDocuments } from './types';
import type { MissionListItem } from '../missions/types';
import type { MissionStop } from '../control-tower/types';

const TYPES = [
  'WAYBILL',
  'GATE_PASS',
  'POD',
  'RECEIVER_SIGNATURE',
  'RECEIVER_STAMP',
  'SHORTAGE_PROOF',
  'RETURN_PROOF',
  'OTHER',
];

export function DocumentsWorkspace({ accessToken }: { accessToken: string }) {
  const { hasPermission } = useSession();
  const [documents, setDocuments] = useState<PaginatedDocuments>();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [missionId, setMissionId] = useState('');
  const [stopId, setStopId] = useState('');
  const [type, setType] = useState('POD');
  const [file, setFile] = useState<File>();
  const [missions, setMissions] = useState<MissionListItem[]>([]);
  const [stops, setStops] = useState<MissionStop[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ page: String(page), limit: '25' });
    if (status) query.set('verificationStatus', status);
    void getDocuments(accessToken, query, controller.signal)
      .then((response) => {
        setDocuments(response);
        setError(undefined);
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted)
          setError(
            requestError instanceof ApiRequestError
              ? requestError.message
              : 'Unable to load documents',
          );
      });
    return () => controller.abort();
  }, [accessToken, page, revision, status]);

  useEffect(() => {
    const controller = new AbortController();
    void getMissions(
      accessToken,
      new URLSearchParams({ page: '1', limit: '100' }),
      controller.signal,
    ).then((response) => setMissions(response.data));
    return () => controller.abort();
  }, [accessToken]);

  useEffect(() => {
    if (!missionId) return;
    const controller = new AbortController();
    void getMission(accessToken, missionId, controller.signal).then((response) =>
      setStops(response.stops),
    );
    return () => controller.abort();
  }, [accessToken, missionId]);

  async function submitUpload(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(undefined);
    try {
      await uploadDocument(accessToken, {
        missionId: missionId.trim(),
        stopId: stopId.trim() || undefined,
        type,
        file,
      });
      setMissionId('');
      setStopId('');
      setFile(undefined);
      setRevision((value) => value + 1);
      (event.currentTarget as HTMLFormElement).reset();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to upload document');
    } finally {
      setBusy(false);
    }
  }

  async function download(id: string, fileName: string) {
    setBusy(true);
    setError(undefined);
    try {
      const url = URL.createObjectURL(await getDocumentContent(accessToken, id));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Unable to download document',
      );
    } finally {
      setBusy(false);
    }
  }

  async function verify(id: string, nextStatus: 'VERIFIED' | 'REJECTED') {
    const notes = nextStatus === 'REJECTED' ? window.prompt('Rejection notes')?.trim() : undefined;
    if (nextStatus === 'REJECTED' && !notes) return;
    setBusy(true);
    setError(undefined);
    try {
      await verifyDocument(accessToken, id, { status: nextStatus, notes });
      setRevision((value) => value + 1);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to verify document');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="dashboard">
      <header className="topbar">
        <div>
          <p className="eyebrow">EVIDENCE</p>
          <h1>Documents</h1>
          <p className="muted">Mission evidence, verification, and secure downloads</p>
        </div>
      </header>
      {hasPermission('document.upload') ? (
        <section className="operations-panel compact-panel">
          <div className="panel-heading">
            <div>
              <h2>Upload evidence</h2>
              <p>PDF, JPEG, or PNG linked to a tenant mission</p>
            </div>
          </div>
          <form className="filters document-upload" onSubmit={submitUpload}>
            <label>
              Mission
              <select
                required
                value={missionId}
                onChange={(event) => {
                  setMissionId(event.target.value);
                  setStopId('');
                  setStops([]);
                }}
              >
                <option value="">Select mission</option>
                {missions.map((mission) => (
                  <option key={mission.id} value={mission.id}>
                    {mission.missionNo}
                    {mission.client ? ` · ${mission.client.name}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Stop (optional)
              <select
                value={stopId}
                onChange={(event) => setStopId(event.target.value)}
                disabled={!missionId}
              >
                <option value="">Mission-level</option>
                {stops.map((stop) => (
                  <option key={stop.id} value={stop.id}>
                    Stop {stop.sequence} · {stop.branch.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Document type
              <select value={type} onChange={(event) => setType(event.target.value)}>
                {TYPES.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              File
              <input
                required
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={(event) => setFile(event.target.files?.[0])}
              />
            </label>
            <button className="primary-button" disabled={busy || !file}>
              Upload
            </button>
          </form>
        </section>
      ) : null}
      <section className="operations-panel">
        <div className="panel-heading">
          <div>
            <h2>Document registry</h2>
            <p>{documents ? `${documents.meta.total} documents` : 'Loading…'}</p>
          </div>
          <label>
            Verification status
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All</option>
              <option value="PENDING">Pending</option>
              <option value="VERIFIED">Verified</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </label>
        </div>
        {error ? (
          <div className="state-panel error-state" role="alert">
            {error}
          </div>
        ) : null}
        {documents ? (
          <div className="mission-table-wrap">
            <table className="mission-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Mission</th>
                  <th>Type</th>
                  <th>Verification</th>
                  <th>Uploaded</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.data.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.originalFileName}</strong>
                      <small>{Math.ceil(item.sizeBytes / 1024)} KB</small>
                    </td>
                    <td>
                      <span>{item.mission.missionNo}</span>
                      <small>{item.stop ? `Stop ${item.stop.sequence}` : 'Mission-level'}</small>
                    </td>
                    <td>{item.type.replaceAll('_', ' ')}</td>
                    <td>
                      <span
                        className={`readiness ${item.verificationStatus === 'VERIFIED' ? 'ready' : 'attention'}`}
                      >
                        {item.verificationStatus}
                      </span>
                      <small>{item.verificationNotes}</small>
                    </td>
                    <td>
                      <span>{item.uploadedBy.name}</span>
                      <small>{new Date(item.createdAt).toLocaleString()}</small>
                    </td>
                    <td>
                      <button
                        className="mission-view-button"
                        disabled={busy}
                        onClick={() => void download(item.id, item.originalFileName)}
                      >
                        Download
                      </button>
                      {hasPermission('document.verify') && item.verificationStatus === 'PENDING' ? (
                        <>
                          <button
                            className="mission-view-button"
                            disabled={busy}
                            onClick={() => void verify(item.id, 'VERIFIED')}
                          >
                            Verify
                          </button>
                          <button
                            className="mission-view-button danger"
                            disabled={busy}
                            onClick={() => void verify(item.id, 'REJECTED')}
                          >
                            Reject
                          </button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="state-panel" role="status">
            Loading documents…
          </div>
        )}
        {documents && documents.data.length === 0 ? (
          <div className="state-panel">No documents match this filter.</div>
        ) : null}
        {documents && documents.meta.totalPages > 1 ? (
          <div className="pagination">
            <button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>
              Previous
            </button>
            <span>
              Page {page} of {documents.meta.totalPages}
            </span>
            <button
              disabled={page === documents.meta.totalPages}
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
