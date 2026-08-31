'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ApiRequestError,
  createRuleConfiguration,
  getRuleConfigurationOptions,
  getRuleConfigurations,
  reevaluateOperationalRules,
} from '../../lib/api-client';
import type {
  CreateRuleConfigurationInput,
  RuleConfiguration,
  RuleConfigurationOptions,
  SupportedRuleScope,
} from './types';
import { AuditTimeline } from '../audit/audit-timeline';
import { useI18n } from '../../i18n/i18n-provider';
import { translateVisibleText } from '../../i18n/localized-surface';

export function RuleConfigurationWorkspace({
  accessToken,
  onClose = () => undefined,
}: {
  accessToken: string;
  onClose?: () => void;
}) {
  const { locale } = useI18n();
  const [options, setOptions] = useState<RuleConfigurationOptions>();
  const [configurations, setConfigurations] = useState<RuleConfiguration[]>([]);
  const [ruleCode, setRuleCode] = useState('LOADING_DELAY');
  const [scopeType, setScopeType] = useState<SupportedRuleScope>('ORGANIZATION');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [reevaluationNotice, setReevaluationNotice] = useState<string>();
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      getRuleConfigurationOptions(accessToken, controller.signal),
      getRuleConfigurations(accessToken, controller.signal),
    ])
      .then(([nextOptions, nextConfigurations]) => {
        setOptions(nextOptions);
        setConfigurations(nextConfigurations);
        setRuleCode((current) =>
          nextOptions.definitions.some(({ code }) => code === current)
            ? current
            : (nextOptions.definitions[0]?.code ?? ''),
        );
      })
      .catch((cause: unknown) => setError(message(cause)))
      .finally(() => setBusy(false));
    return () => controller.abort();
  }, [accessToken, revision]);

  const definition = options?.definitions.find(({ code }) => code === ruleCode);
  const isQuantityRule = ruleCode === 'SHORTAGE' || ruleCode === 'REJECTION';
  const scopeOptions = useMemo(() => {
    if (!options) return [];
    if (scopeType === 'ORGANIZATION') return [options.organization];
    if (scopeType === 'CLIENT') return options.scopes.clients;
    if (scopeType === 'WAREHOUSE') return options.scopes.warehouses;
    if (scopeType === 'CARRIER') return options.scopes.carriers;
    return options.scopes.contracts;
  }, [options, scopeType]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const calendarText = text(data, 'workingCalendar');
      const workingCalendar = calendarText ? parseCalendar(calendarText) : undefined;
      const input: CreateRuleConfigurationInput = {
        ruleCode,
        scopeType,
        scopeId: text(data, 'scopeId'),
        priority: number(data, 'priority') ?? 0,
        isEnabled: data.get('isEnabled') === 'on',
        thresholdMinutes: number(data, 'thresholdMinutes'),
        quantityTolerance: number(data, 'quantityTolerance'),
        severity: (text(data, 'severity') || undefined) as CreateRuleConfigurationInput['severity'],
        isBlocking: data.get('isBlocking') === 'on',
        ownerUserId: text(data, 'ownerUserId') || undefined,
        timeZone: text(data, 'timeZone') || undefined,
        workingCalendar,
        effectiveFrom: localDate(data, 'effectiveFrom'),
        effectiveTo: optionalLocalDate(data, 'effectiveTo'),
      };
      await createRuleConfiguration(accessToken, input);
      setNotice('A new immutable rule version was created and audited.');
      form.reset();
      setRevision((value) => value + 1);
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  async function reevaluate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError(undefined);
    setReevaluationNotice(undefined);
    try {
      const result = await reevaluateOperationalRules(accessToken, {
        evaluationAt: localDate(data, 'reevaluationAt'),
        missionId: text(data, 'missionId') || undefined,
        scheduledFrom: optionalLocalDate(data, 'scheduledFrom'),
        scheduledTo: optionalLocalDate(data, 'scheduledTo'),
        maxMissions: number(data, 'maxMissions') ?? 100,
      });
      setReevaluationNotice(
        `${result.missions} missions reviewed · ${result.timeRulesEvaluated} due time rules evaluated · ${result.futureOperationsSkipped} future operations skipped`,
      );
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
      aria-label="Rule configuration"
    >
      <section className="rule-workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">RULE GOVERNANCE</p>
            <h2>Rule configuration</h2>
            <p>Create immutable, effective-dated tenant rule versions.</p>
          </div>
          <button className="quiet-button" onClick={onClose}>
            Close
          </button>
        </header>

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

        <div className="rule-layout">
          <form className="rule-form" onSubmit={(event) => void submit(event)}>
            <section>
              <h3>Rule and scope</h3>
              <label>
                Rule
                <select
                  value={ruleCode}
                  onChange={(event) => setRuleCode(event.target.value)}
                  required
                >
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
                  onChange={(event) => setScopeType(event.target.value as SupportedRuleScope)}
                >
                  <option value="ORGANIZATION">Organization default</option>
                  <option value="CLIENT">Client</option>
                  <option value="WAREHOUSE">Warehouse</option>
                  <option value="CARRIER">Carrier</option>
                  <option value="CONTRACT">Contract</option>
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
                Route and driver SLA scopes remain unavailable under the approved rules.
              </p>
            </section>

            <section>
              <h3>Condition</h3>
              {isQuantityRule ? (
                <label>
                  Quantity tolerance
                  <input
                    min="0"
                    name="quantityTolerance"
                    step="0.001"
                    type="number"
                    placeholder={definition?.defaultQuantityTolerance ?? 'No product default'}
                  />
                </label>
              ) : (
                <label>
                  Threshold in minutes
                  <input
                    min="0"
                    name="thresholdMinutes"
                    step="1"
                    type="number"
                    placeholder={
                      definition?.defaultThresholdMinutes === null
                        ? 'Required to activate time evaluation'
                        : `Product default: ${definition?.defaultThresholdMinutes}`
                    }
                  />
                </label>
              )}
              <label>
                Severity
                <select name="severity" defaultValue="">
                  <option value="">Unspecified</option>
                  <option>INFO</option>
                  <option>WARNING</option>
                  <option>HIGH</option>
                  <option>CRITICAL</option>
                </select>
              </label>
              <label>
                Priority
                <input defaultValue="0" name="priority" step="1" type="number" />
              </label>
              <label className="check-field">
                <input
                  defaultChecked={definition?.enabledByDefault}
                  name="isEnabled"
                  type="checkbox"
                  key={`${ruleCode}-enabled`}
                />{' '}
                Enabled for this scope
              </label>
              <label className="check-field">
                <input name="isBlocking" type="checkbox" /> Blocking configuration
              </label>
              <p className="field-help warning-copy">
                A blocking flag is recorded, but no mission transition is blocked until a
                transition-specific policy is approved.
              </p>
            </section>

            <section>
              <h3>Responsibility and time</h3>
              <label>
                Default owner
                <select name="ownerUserId" defaultValue="">
                  <option value="">Unassigned</option>
                  {options?.owners.map((owner) => (
                    <option value={owner.id} key={owner.id}>
                      {owner.name} · {owner.email}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                IANA time zone
                <input name="timeZone" placeholder="For example: Asia/Muscat" />
              </label>
              <label>
                Working-calendar metadata (JSON)
                <textarea
                  name="workingCalendar"
                  placeholder='{"calendarId":"approved-calendar-reference"}'
                />
              </label>
              <p className="field-help warning-copy">
                Calendar metadata is stored and versioned. It does not alter elapsed time until its
                business schema is approved.
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
                Periods cannot overlap for the same rule and scope. New versions do not trigger
                retroactive evaluation.
              </p>
              <button
                className="primary-button"
                disabled={busy || !options || scopeOptions.length === 0}
                type="submit"
              >
                {busy ? 'Saving…' : 'Create rule version'}
              </button>
            </section>
          </form>

          <section className="configuration-history">
            <div>
              <h3>Version history</h3>
              <p>{configurations.length} tenant configuration versions</p>
            </div>
            <form className="manual-evaluation-form" onSubmit={(event) => void reevaluate(event)}>
              <h4>Manual reevaluation</h4>
              <p>
                Provide an explicit evaluation time and either one mission or a bounded schedule
                window.
              </p>
              <label>
                Evaluation at
                <input required name="reevaluationAt" type="datetime-local" />
              </label>
              <label>
                Mission UUID
                <input name="missionId" placeholder="Optional when a window is supplied" />
              </label>
              <div>
                <label>
                  Scheduled from
                  <input name="scheduledFrom" type="datetime-local" />
                </label>
                <label>
                  Scheduled to
                  <input name="scheduledTo" type="datetime-local" />
                </label>
              </div>
              <label>
                Maximum missions
                <input defaultValue="100" max="500" min="1" name="maxMissions" type="number" />
              </label>
              <button className="filter-button" disabled={busy} type="submit">
                Run reevaluation
              </button>
              {reevaluationNotice ? <small role="status">{reevaluationNotice}</small> : null}
            </form>
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
                    <dt>Condition</dt>
                    <dd>
                      {item.thresholdMinutes !== null
                        ? `${item.thresholdMinutes} minutes`
                        : item.quantityTolerance !== null
                          ? `Tolerance ${item.quantityTolerance}`
                          : 'Definition default / no value'}
                    </dd>
                    <dt>Policy</dt>
                    <dd>
                      {item.isEnabled ? 'Enabled' : 'Disabled'} ·{' '}
                      {item.severity ?? 'Severity unset'} ·{' '}
                      {item.isBlocking ? 'Blocking flag' : 'Warning'}
                    </dd>
                    <dt>Owner</dt>
                    <dd>{item.owner?.name ?? 'Unassigned'}</dd>
                  </dl>
                  <AuditTimeline
                    accessToken={accessToken}
                    contextType="RULE_CONFIGURATION"
                    contextId={item.id}
                  />
                </article>
              ))
            ) : (
              <p className="empty-copy">
                No scoped versions exist. Product definitions remain in effect.
              </p>
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
function number(data: FormData, name: string) {
  const value = text(data, name);
  return value === '' ? undefined : Number(value);
}
function localDate(data: FormData, name: string) {
  return new Date(text(data, name)).toISOString();
}
function optionalLocalDate(data: FormData, name: string) {
  const value = text(data, name);
  return value ? new Date(value).toISOString() : undefined;
}
function parseCalendar(value: string) {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error('Working-calendar metadata must be a JSON object');
  return parsed as Record<string, unknown>;
}
function format(value: string, locale: 'en' | 'ar-SA') {
  return new Date(value).toLocaleString(locale);
}
function message(cause: unknown) {
  return cause instanceof ApiRequestError || cause instanceof Error
    ? cause.message
    : 'Request failed';
}
