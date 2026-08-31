'use client';

import { useEffect, useMemo, useState } from 'react';
import { ApiRequestError, getCurrentDriverMissions } from '../../lib/api-client';
import { useI18n } from '../../i18n/i18n-provider';
import { translateVisibleText } from '../../i18n/localized-surface';
import type { MissionListItem, PaginatedMissions } from '../missions/types';

type Period = 'current' | 'today' | 'week' | 'completed';
const terminal = ['DELIVERED', 'OPERATIONALLY_CLOSED', 'ACCOUNTING_READY', 'CLOSED', 'CANCELLED'];

export function DriverCommandDashboard({ accessToken }: { accessToken: string }) {
  const { locale } = useI18n();
  const ar = locale === 'ar-SA';
  const [data, setData] = useState<PaginatedMissions>();
  const [period, setPeriod] = useState<Period>('current');
  const [error, setError] = useState<string>();
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void getCurrentDriverMissions(accessToken, controller.signal).then((value) => { setData(value); setError(undefined); }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof ApiRequestError ? cause.message : ar ? 'تعذر تحميل مهام السائق' : 'Unable to load driver assignments');
    });
    return () => controller.abort();
  }, [accessToken, ar, revision]);

  const missions = useMemo(() => data?.data ?? [], [data]);
  const filtered = useMemo(() => {
    const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const week = new Date(start); week.setDate(start.getDate() - start.getDay());
    if (period === 'current') return missions.filter((mission) => !terminal.includes(mission.status));
    if (period === 'completed') return missions.filter((mission) => terminal.includes(mission.status));
    const lower = period === 'today' ? start : week;
    return missions.filter((mission) => mission.scheduledLoadingAt && new Date(mission.scheduledLoadingAt) >= lower);
  }, [missions, period]);
  const current = missions.find((mission) => !terminal.includes(mission.status));

  return <main className="driver-command-center">
    <header className="driver-command-hero"><div><p className="eyebrow">{ar ? 'مساحة السائق' : 'DRIVER WORKSPACE'}</p><h1>{ar ? 'رحلتك تبدأ من هنا' : 'Your route starts here'}</h1><p>{ar ? 'المهمة الحالية، المركبة، والوجهة التالية في شاشة واحدة.' : 'Your current assignment, vehicle, and next destination in one focused view.'}</p></div><div className="driver-online"><i /><span>{ar ? 'متصل بالنظام' : 'Connected'}</span></div></header>
    {error ? <section className="state-panel error-state" role="alert"><strong>{error}</strong><button className="quiet-button" onClick={() => setRevision((value) => value + 1)}>{ar ? 'إعادة المحاولة' : 'Retry'}</button></section> : null}
    {!data && !error ? <section className="state-panel" role="status">{ar ? 'جارٍ تحميل مهامك…' : 'Loading your assignments…'}</section> : null}
    {data ? <>
      <section className="driver-summary-grid"><Summary label={ar ? 'المهمة الحالية' : 'Current assignment'} value={current ? '1' : '0'} /><Summary label={ar ? 'رحلات اليوم' : 'Today’s trips'} value={String(missions.filter((item) => isToday(item.scheduledLoadingAt)).length)} /><Summary label={ar ? 'المكتملة' : 'Completed'} value={String(missions.filter((item) => terminal.includes(item.status)).length)} /></section>
      {current ? <section className="driver-current-card"><div className="driver-current-top"><div><small>{ar ? 'المهمة الحالية' : 'CURRENT ASSIGNMENT'}</small><h2>{current.missionNo}</h2></div><Status mission={current} locale={locale} /></div><div className="driver-route-visual"><span className="route-node start" /><i /><span className="route-node end" /></div><div className="driver-route-labels"><div><small>{ar ? 'الانطلاق' : 'FROM'}</small><strong>{current.warehouse.name}</strong></div><div><small>{ar ? 'الوجهة' : 'DESTINATION'}</small><strong>{current.route?.name ?? (ar ? 'غير محددة' : 'Not set')}</strong></div></div><dl><div><dt>{ar ? 'المركبة' : 'Vehicle'}</dt><dd>{current.vehicle?.plateNo ?? '—'}</dd></div><div><dt>{ar ? 'شركة النقل' : 'Carrier'}</dt><dd>{current.carrier?.name ?? '—'}</dd></div><div><dt>{ar ? 'موعد التحميل' : 'Loading time'}</dt><dd>{formatDate(current.scheduledLoadingAt, locale)}</dd></div><div><dt>{ar ? 'العميل' : 'Client'}</dt><dd>{current.client.name}</dd></div></dl><div className="driver-next-action"><span>{ar ? 'الإجراء التالي' : 'NEXT ACTION'}</span><strong>{nextAction(current.status, ar)}</strong><small>{ar ? 'تحديثات التنفيذ ستُفعّل بعد اعتماد صلاحيات الإجراءات الميدانية.' : 'Execution updates will be enabled after field-action permissions are approved.'}</small></div></section> : <section className="driver-rest-state"><span>✓</span><h2>{ar ? 'لا توجد رحلة نشطة الآن' : 'No active trip right now'}</h2><p>{ar ? 'ستظهر المهمة هنا فور إسنادها إليك.' : 'Your next assignment will appear here when dispatched.'}</p></section>}
      <nav className="driver-period-tabs" aria-label={ar ? 'فترات الرحلات' : 'Trip periods'}>{(['current','today','week','completed'] as const).map((item) => <button className={period === item ? 'active' : ''} key={item} onClick={() => setPeriod(item)}>{periodLabel(item, ar)}</button>)}</nav>
      <section className="driver-trip-list"><header><h2>{ar ? 'قائمة الرحلات' : 'Trip list'}</h2><span>{filtered.length}</span></header>{filtered.length ? filtered.map((mission) => <article key={mission.id}><div><strong>{mission.missionNo}</strong><small>{mission.route?.name ?? mission.warehouse.name}</small></div><div><small>{ar ? 'المركبة' : 'Vehicle'}</small><b>{mission.vehicle?.plateNo ?? '—'}</b></div><div><small>{ar ? 'الموعد' : 'Schedule'}</small><b>{formatDate(mission.scheduledLoadingAt, locale)}</b></div><Status mission={mission} locale={locale} /></article>) : <div className="state-panel">{ar ? 'لا توجد رحلات في هذه الفترة.' : 'No trips in this period.'}</div>}</section>
    </> : null}
  </main>;
}

function Summary({ label, value }: { label: string; value: string }) { return <article><span>{label}</span><strong>{value}</strong></article>; }
function Status({ mission, locale }: { mission: MissionListItem; locale: 'en' | 'ar-SA' }) { return <span className={`status-badge status-${mission.status.toLowerCase()}`}>{translateVisibleText(mission.status.replaceAll('_', ' '), locale)}</span>; }
function isToday(value: string | null) { if (!value) return false; const date = new Date(value); const now = new Date(); return date.toDateString() === now.toDateString(); }
function formatDate(value: string | null, locale: string) { return value ? new Date(value).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) : '—'; }
function periodLabel(period: Period, ar: boolean) { const labels: Record<Period, [string, string]> = { current: ['الحالية', 'Current'], today: ['اليوم', 'Today'], week: ['الأسبوع', 'Week'], completed: ['المكتملة', 'Completed'] }; return labels[period][ar ? 0 : 1]; }
function nextAction(status: string, ar: boolean) { const actions: Record<string, [string,string]> = { ASSIGNED: ['التوجه إلى المستودع','Proceed to warehouse'], WAITING_FOR_VEHICLE: ['انتظار المركبة','Wait for vehicle'], VEHICLE_ARRIVED: ['بدء التحميل','Start loading'], LOADING: ['إكمال التحميل','Complete loading'], LOADED: ['بدء الرحلة','Start trip'], DEPARTED: ['التوجه إلى الوجهة','Proceed to destination'], IN_TRANSIT: ['متابعة المسار','Continue route'], AT_STOP: ['بدء التفريغ','Start unloading'], DELIVERING: ['تأكيد التسليم','Confirm delivery'] }; return actions[status]?.[ar ? 0 : 1] ?? (ar ? 'مراجعة المهمة' : 'Review assignment'); }
