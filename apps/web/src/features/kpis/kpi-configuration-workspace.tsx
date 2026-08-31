'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ApiRequestError,
  createKpiConfiguration,
  getKpiConfigurationOptions,
  getKpiConfigurations,
} from '../../lib/api-client';
import { AuditTimeline } from '../audit/audit-timeline';
import type {
  CreateKpiConfigurationInput,
  KpiConfiguration,
  KpiConfigurationOptions,
  SupportedKpiScope,
} from './types';
import { useI18n } from '../../i18n/i18n-provider';
import { translateVisibleText } from '../../i18n/localized-surface';

const JSON_FIELDS = [
  [
    'formula',
    'Formula contract',
    '{"numerator":"approved source","denominator":"approved source"}',
    'عقد المعادلة',
    '{"numerator":"مصدر معتمد","denominator":"مصدر معتمد"}',
  ],
  ['eligibility', 'Eligibility contract', '{"include":[],"exclude":[]}', 'عقد الأهلية', '{"include":[],"exclude":[]}'],
  ['dataSources', 'Data sources', '{"events":[],"fields":[]}', 'مصادر البيانات', '{"events":[],"fields":[]}'],
  ['periodDefinition', 'Period definition', '{"type":"approved period"}', 'تعريف الفترة', '{"type":"فترة معتمدة"}'],
  ['targets', 'Thresholds and targets', '{"target":"approved value"}', 'الحدود والأهداف', '{"target":"قيمة معتمدة"}'],
] as const;

export function KpiConfigurationWorkspace({
  accessToken,
  onClose = () => undefined,
}: {
  accessToken: string;
  onClose?: () => void;
}) {
  const { locale } = useI18n();
  const [options, setOptions] = useState<KpiConfigurationOptions>();
  const [configurations, setConfigurations] = useState<KpiConfiguration[]>([]);
  const [kpiCode, setKpiCode] = useState('ON_TIME_LOADING');
  const [scopeType, setScopeType] = useState<SupportedKpiScope>('ORGANIZATION');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      getKpiConfigurationOptions(accessToken, controller.signal),
      getKpiConfigurations(accessToken, controller.signal),
    ])
      .then(([nextOptions, nextConfigurations]) => {
        setOptions(nextOptions);
        setConfigurations(nextConfigurations);
        setKpiCode((current) =>
          nextOptions.definitions.some(({ code }) => code === current)
            ? current
            : (nextOptions.definitions[0]?.code ?? ''),
        );
      })
      .catch((cause: unknown) => setError(message(cause)))
      .finally(() => setBusy(false));
    return () => controller.abort();
  }, [accessToken, revision]);

  const definition = options?.definitions.find(({ code }) => code === kpiCode);
  const scopeOptions = useMemo(() => {
    if (!options) return [];
    if (scopeType === 'ORGANIZATION') return [options.organization];
    if (scopeType === 'CLIENT') return options.scopes.clients;
    if (scopeType === 'WAREHOUSE') return options.scopes.warehouses;
    if (scopeType === 'CARRIER') return options.scopes.carriers;
    if (scopeType === 'CONTRACT') return options.scopes.contracts;
    return options.scopes.drivers;
  }, [options, scopeType]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const input: CreateKpiConfigurationInput = {
        kpiCode,
        scopeType,
        scopeId: text(data, 'scopeId'),
        isEnabled: data.get('isEnabled') === 'on',
        formula: json(data, 'formula'),
        eligibility: json(data, 'eligibility'),
        dataSources: json(data, 'dataSources'),
        periodDefinition: json(data, 'periodDefinition'),
        targets: json(data, 'targets'),
        targetPercent: numeric(data, 'targetPercent'),
        roundingMode: text(data, 'roundingMode') || undefined,
        decimalScale: numeric(data, 'decimalScale'),
        calculationFrequency: text(data, 'calculationFrequency') || undefined,
        timeZone: text(data, 'timeZone') || undefined,
        effectiveFrom: localDate(data, 'effectiveFrom'),
        effectiveTo: optionalLocalDate(data, 'effectiveTo'),
      };
      await createKpiConfiguration(accessToken, input);
      setNotice('KPI contract version saved and audited. No KPI value was calculated.');
      form.reset();
      setRevision((value) => value + 1);
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="workspace-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="KPI configuration"
    >
      <section className="kpi-workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">KPI GOVERNANCE</p>
            <h2>KPI definition registry</h2>
            <p>Version KPI contracts without producing unapproved operational values.</p>
          </div>
          <button className="quiet-button" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="calculation-disabled-banner">
          <strong>Calculation disabled</strong>
          <span>No KPI engine, aggregate, score, or historical backfill is active.</span>
        </div>
        {error ? (
          <p className="form-error workspace-message" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="success-message workspace-message" role="status">
            {notice}
          </p>
        ) : null}
        <div className="kpi-layout">
          <form className="kpi-form" onSubmit={(event) => void submit(event)}>
            <section>
              <h3>Identity and scope</h3>
              <label>
                KPI
                <select value={kpiCode} onChange={(event) => setKpiCode(event.target.value)}>
                  {options?.definitions.map((item) => (
                    <option value={item.code} key={item.code}>
                      {translateVisibleText(item.name, locale)} · {item.code}
                    </option>
                  ))}
                </select>
              </label>
              <p className="field-help">{definition ? translateVisibleText(definition.description, locale) : ''}</p>
              <label>
                Scope type
                <select
                  value={scopeType}
                  onChange={(event) => setScopeType(event.target.value as SupportedKpiScope)}
                >
                  <option value="ORGANIZATION">Organization</option>
                  <option value="CLIENT">Client</option>
                  <option value="WAREHOUSE">Warehouse</option>
                  <option value="CARRIER">Carrier</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="DRIVER">Driver</option>
                </select>
              </label>
              <label>
                Scope
                <select name="scopeId" required key={scopeType}>
                  {scopeOptions.map((item) => (
                    <option value={item.id} key={item.id}>
                      {'code' in item ? `${item.name} · ${item.code}` : item.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="field-help warning-copy">
                Route scope remains unavailable until a validated KPI route model exists.
              </p>
            </section>
            <section className="kpi-contract-fields">
              <h3>Definition contract</h3>
              {JSON_FIELDS.map(([name, label, placeholder, arabicLabel, arabicPlaceholder]) => (
                <label key={name}>
                  {locale === 'ar-SA' ? arabicLabel : label}
                  <textarea
                    name={name}
                    placeholder={locale === 'ar-SA' ? arabicPlaceholder : placeholder}
                  />
                </label>
              ))}
              <p className="field-help">
                Empty fields mean the contract is incomplete; the system does not infer values.
              </p>
            </section>
            <section>
              <h3>Calculation governance</h3>
              <label>
                Rounding mode
                <input name="roundingMode" placeholder="Requires approved terminology" />
              </label>
              <label>
                Decimal scale
                <input min="0" name="decimalScale" type="number" />
              </label>
              <label>
                Target percent
                <input defaultValue="90" max="100" min="0" name="targetPercent" type="number" />
              </label>
              <label>
                Calculation frequency
                <select defaultValue="DAILY" name="calculationFrequency">
                  <option value="DAILY">Daily</option>
                </select>
              </label>
              <label>
                IANA time zone
                <input name="timeZone" placeholder="For example: Asia/Muscat" />
              </label>
              <label className="check-field">
                <input name="isEnabled" type="checkbox" /> Contract enabled
              </label>
              <p className="field-help warning-copy">
                Enabled records are configuration only. They do not activate calculation.
              </p>
            </section>
            <section>
              <h3>Effective period</h3>
              <label>
                Effective from
                <input name="effectiveFrom" required type="datetime-local" />
              </label>
              <label>
                Effective to
                <input name="effectiveTo" type="datetime-local" />
              </label>
              <p className="field-help">
                Periods cannot overlap for the same KPI and scope. New versions do not backfill
                history.
              </p>
              <button
                className="primary-button"
                disabled={busy || !options || scopeOptions.length === 0}
                type="submit"
              >
                {busy ? 'Saving…' : 'Save KPI contract version'}
              </button>
            </section>
          </form>
          <section className="configuration-history">
            <div>
              <h3>KPI contract history</h3>
              <p>{configurations.length} tenant versions · zero calculated values</p>
            </div>
            {configurations.length ? (
              configurations.map((item) => (
                <article key={item.id}>
                  <div>
                    <strong>{translateVisibleText(item.definition.name, locale)}</strong>
                    <span>
                      {locale === 'ar-SA' ? 'الإصدار' : 'v'} {item.version} · {translateVisibleText(item.scopeType, locale)}
                    </span>
                  </div>
                  <dl>
                    <dt>Period</dt>
                    <dd>
                      {format(item.effectiveFrom, locale)} →{' '}
                      {item.effectiveTo ? format(item.effectiveTo, locale) : 'Open-ended'}
                    </dd>
                    <dt>Contract</dt>
                    <dd>{completeness(item)} fields supplied</dd>
                    <dt>Enabled</dt>
                    <dd>{item.isEnabled ? 'Configuration enabled' : 'Draft/disabled'}</dd>
                    <dt>Values</dt>
                    <dd>Not calculated</dd>
                  </dl>
                  <AuditTimeline
                    accessToken={accessToken}
                    contextType="KPI_CONFIGURATION"
                    contextId={item.id}
                  />
                </article>
              ))
            ) : (
              <p className="empty-copy">No KPI contracts exist.</p>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}

function text(data: FormData, name: string) {
  return String(data.get(name) ?? '').trim();
}
function numeric(data: FormData, name: string) {
  const value = text(data, name);
  return value ? Number(value) : undefined;
}
function json(data: FormData, name: string) {
  const value = text(data, name);
  if (!value) return undefined;
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error(`${name} must be a JSON object`);
  return parsed as Record<string, unknown>;
}
function localDate(data: FormData, name: string) {
  return new Date(text(data, name)).toISOString();
}
function optionalLocalDate(data: FormData, name: string) {
  const value = text(data, name);
  return value ? new Date(value).toISOString() : undefined;
}
function format(value: string, locale: 'en' | 'ar-SA') {
  return new Date(value).toLocaleString(locale);
}
function completeness(item: KpiConfiguration) {
  return [
    item.formula,
    item.eligibility,
    item.dataSources,
    item.periodDefinition,
    item.targets,
  ].filter(Boolean).length;
}
function message(cause: unknown) {
  return cause instanceof ApiRequestError || cause instanceof Error
    ? cause.message
    : 'Request failed';
}
