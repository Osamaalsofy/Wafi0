'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  ApiRequestError,
  archiveResource,
  createResource,
  listResource,
  updateResource,
} from '../../lib/api-client';
import { useSession } from '../auth/session-provider';
import { useI18n } from '../../i18n/i18n-provider';

export interface MasterRecord {
  id: string;
  code?: string;
  name?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  createdAt: string;
  [key: string]: unknown;
}
export interface MasterField {
  key: string;
  label: string;
  required?: boolean;
  type?: 'text' | 'tel' | 'number' | 'select';
  createOnly?: boolean;
  optionsPath?: string;
  optionLabel?: (record: MasterRecord) => string;
  submit?: boolean;
  dependsOn?: { fieldKey: string; optionRelationKey: string };
}

export interface MasterDataConfig {
  path: string;
  title: string;
  singular: string;
  eyebrow: string;
  description: string;
  permission: string;
  fields: MasterField[];
  columns: Array<{ key: string; label: string }>;
}

function display(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') {
    const named = value as { name?: string; nameEn?: string; nameAr?: string; code?: string };
    return named.name ?? named.nameEn ?? named.nameAr ?? named.code ?? '—';
  }
  return String(value);
}

export function MasterDataWorkspace({
  accessToken,
  config,
}: {
  accessToken: string;
  config: MasterDataConfig;
}) {
  const { hasPermission } = useSession();
  const { locale } = useI18n();
  const arabic = locale === 'ar-SA';
  const [records, setRecords] = useState<{
    data: MasterRecord[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }>();
  const [values, setValues] = useState<Record<string, string>>({});
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState<MasterRecord>();
  const [options, setOptions] = useState<Record<string, MasterRecord[]>>({});

  useEffect(() => {
    const controller = new AbortController();
    const optionFields = config.fields.filter((field) => field.optionsPath);
    void Promise.all(
      optionFields.map(
        async (field) =>
          [
            field.key,
            (
              await listResource<MasterRecord>(
                accessToken,
                field.optionsPath!,
                new URLSearchParams({ page: '1', limit: '100', status: 'ACTIVE' }),
                controller.signal,
              )
            ).data,
        ] as const,
      ),
    )
      .then((entries) => {
        if (!controller.signal.aborted) setOptions(Object.fromEntries(entries));
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          requestError instanceof ApiRequestError
            ? requestError.message
            : arabic
              ? 'تعذر تحميل خيارات النموذج'
              : 'Unable to load form options',
        );
      });
    return () => controller.abort();
  }, [accessToken, arabic, config]);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      page: String(page),
      limit: '25',
      sortBy: config.columns[0]?.key ?? 'name',
      sortOrder: 'asc',
    });
    if (search) query.set('search', search);
    if (status) query.set('status', status);
    void listResource<MasterRecord>(accessToken, config.path, query, controller.signal)
      .then((response) => {
        setRecords(response);
        setError(undefined);
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted)
          setError(
            requestError instanceof ApiRequestError
              ? requestError.message
              : arabic ? 'تعذر تحميل البيانات' : `Unable to load ${config.title.toLowerCase()}`,
          );
      });
    return () => controller.abort();
  }, [accessToken, arabic, config, page, revision, search, status]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    const body = Object.fromEntries(
      config.fields.filter((field) => field.submit !== false).map((field) => [
        field.key,
        field.type === 'number' && values[field.key]
          ? Number(values[field.key])
          : values[field.key]?.trim() || undefined,
      ]),
    );
    try {
      await createResource(accessToken, config.path, body);
      setValues({});
      setRevision((value) => value + 1);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : arabic ? 'تعذر إنشاء السجل' : `Unable to create ${config.singular.toLowerCase()}`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(record: MasterRecord) {
    setBusy(true);
    setError(undefined);
    try {
      await updateResource(accessToken, `${config.path}/${record.id}`, {
        status: record.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      });
      setRevision((value) => value + 1);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : arabic ? 'تعذر تحديث السجل' : `Unable to update ${config.singular.toLowerCase()}`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError(undefined);
    const body = Object.fromEntries(
      config.fields
        .filter((field) => field.submit !== false && !field.createOnly && field.key !== 'clientId' && field.key !== 'carrierId')
        .map((field) => [
          field.key,
          field.type === 'number' && values[field.key]
            ? Number(values[field.key])
            : values[field.key]?.trim() || null,
        ]),
    );
    try {
      await updateResource(accessToken, `${config.path}/${editing.id}`, body);
      setEditing(undefined);
      setValues({});
      setRevision((value) => value + 1);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : arabic ? 'تعذر حفظ التغييرات' : 'Unable to save changes',
      );
    } finally {
      setBusy(false);
    }
  }

  function fieldControl(field: MasterField) {
    if (field.optionsPath) {
      const availableOptions = (options[field.key] ?? []).filter((option) => {
        if (!field.dependsOn) return true;
        const relation = option[field.dependsOn.optionRelationKey] as { id?: string } | undefined;
        return relation?.id === values[field.dependsOn.fieldKey];
      });
      return (
        <select
          required={field.required}
          value={values[field.key] ?? ''}
          onChange={(event) => setValues({ ...values, [field.key]: event.target.value, ...(field.key === 'regionId' ? { governorateId: '' } : {}) })}
          disabled={Boolean(field.dependsOn && !values[field.dependsOn.fieldKey])}
        >
          <option value="">Select {field.label.toLowerCase()}</option>
          {availableOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {field.optionLabel?.(option) ?? `${option.name ?? ''} · ${option.code ?? ''}`}
            </option>
          ))}
        </select>
      );
    }
    return (
      <input
        required={field.required}
        type={field.type === 'select' ? 'text' : (field.type ?? 'text')}
        value={values[field.key] ?? ''}
        onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
      />
    );
  }

  async function archive(record: MasterRecord) {
    const recordName = record.name ?? record.code ?? config.singular;
    if (!window.confirm(arabic ? `هل تريد أرشفة ${recordName}؟` : `Archive ${recordName}?`)) return;
    setBusy(true);
    setError(undefined);
    try {
      await archiveResource(accessToken, `${config.path}/${record.id}/archive`);
      setRevision((value) => value + 1);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : arabic ? 'تعذر أرشفة السجل' : `Unable to archive ${config.singular.toLowerCase()}`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="dashboard">
      <header className="topbar">
        <div>
          <p className="eyebrow">{config.eyebrow}</p>
          <h1>{config.title}</h1>
          <p className="muted">{config.description}</p>
        </div>
      </header>
      {hasPermission(`${config.permission}.create`) ? (
        <section className="operations-panel compact-panel">
          <div className="panel-heading">
            <div>
              <h2>Create {config.singular.toLowerCase()}</h2>
              <p>Saved directly to the tenant registry</p>
            </div>
          </div>
          <form className="filters master-form" onSubmit={create}>
            {config.fields.map((field) => (
              <label key={field.key}>
                {field.label}
                {fieldControl(field)}
              </label>
            ))}
            <button className="primary-button" disabled={busy}>
              Create
            </button>
          </form>
        </section>
      ) : null}
      <section className="operations-panel">
        <div className="panel-heading">
          <div>
            <h2>{config.singular} registry</h2>
            <p>{records ? `${records.meta.total} records` : 'Loading…'}</p>
          </div>
          <form
            className="filters"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setSearch(searchInput.trim());
            }}
          >
            <label className="search-field">
              <span className="sr-only">Search {config.title}</span>
              <input
                placeholder={`Search ${config.title.toLowerCase()}`}
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
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
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </label>
            <button className="filter-button">Apply</button>
          </form>
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
                  {config.columns.map((column) => (
                    <th key={column.key}>{column.label}</th>
                  ))}
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.data.map((record) => (
                  <tr key={record.id}>
                    {config.columns.map((column) => (
                      <td key={column.key}>{display(record[column.key])}</td>
                    ))}
                    <td>
                      <span className={`status-badge status-${record.status.toLowerCase()}`}>
                        {record.status}
                      </span>
                    </td>
                    <td>
                      {hasPermission(`${config.permission}.update`) &&
                      record.status !== 'ARCHIVED' ? (
                        <button
                          className="mission-view-button"
                          disabled={busy}
                          onClick={() => {
                            setEditing(record);
                            setValues(
                              Object.fromEntries(
                                config.fields.map((field) => [
                                  field.key,
                                  field.key === 'regionId'
                                    ? String((record.governorate as { region?: { id?: string } } | undefined)?.region?.id ?? '')
                                    : String(record[field.key] ?? ''),
                                ]),
                              ),
                            );
                          }}
                        >
                          Edit
                        </button>
                      ) : null}
                      {hasPermission(`${config.permission}.update`) &&
                      record.status !== 'ARCHIVED' ? (
                        <button
                          className="mission-view-button"
                          disabled={busy}
                          onClick={() => void changeStatus(record)}
                        >
                          {record.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </button>
                      ) : null}
                      {hasPermission(`${config.permission}.archive`) &&
                      record.status !== 'ARCHIVED' ? (
                        <button
                          className="mission-view-button danger"
                          disabled={busy}
                          onClick={() => void archive(record)}
                        >
                          Archive
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
            Loading {config.title.toLowerCase()}…
          </div>
        )}
        {records && records.data.length === 0 ? (
          <div className="state-panel">No records match the current filters.</div>
        ) : null}
        {records && records.meta.totalPages > 1 ? (
          <div className="pagination">
            <button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>
              Previous
            </button>
            <span>
              Page {page} of {records.meta.totalPages}
            </span>
            <button
              disabled={page === records.meta.totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </button>
          </div>
        ) : null}
      </section>
      {editing ? (
        <div className="modal-backdrop" role="presentation">
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-label={`Edit ${config.singular}`}
          >
            <div className="panel-heading">
              <h2>Edit {editing.name ?? editing.code ?? config.singular}</h2>
              <button className="quiet-button" onClick={() => setEditing(undefined)}>
                Close
              </button>
            </div>
            <form className="master-form" onSubmit={saveEdit}>
              {config.fields
                .filter(
                  (field) =>
                    !field.createOnly && field.key !== 'clientId' && field.key !== 'carrierId',
                )
                .map((field) => (
                  <label key={field.key}>
                    {field.label}
                    {fieldControl(field)}
                  </label>
                ))}
              <button className="primary-button" disabled={busy}>
                Save changes
              </button>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}
