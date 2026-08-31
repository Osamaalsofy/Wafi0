'use client';

import { useEffect, useMemo, useState } from 'react';
import { ApiRequestError, getControlTower } from '../../lib/api-client';
import { useI18n } from '../../i18n/i18n-provider';
import { translateVisibleText } from '../../i18n/localized-surface';
import { MissionDetailPanel } from '../control-tower/mission-detail-panel';
import type { ControlTowerMission, ControlTowerResponse } from '../control-tower/types';

type Tab = 'overview' | 'shipments' | 'tracking' | 'documents' | 'performance' | 'warehouses' | 'reports' | 'support';

const terminalStatuses = ['CLOSED', 'CANCELLED'] as const;
const inTransitStatuses = ['DEPARTED', 'IN_TRANSIT', 'AT_STOP', 'DELIVERING'] as const;

const copy = {
  en: {
    eyebrow: 'CUSTOMER COMMAND CENTER', title: 'Your logistics, clearly in view',
    subtitle: 'Track shipments, act on exceptions, and verify delivery readiness from one focused workspace.',
    overview: 'Overview', shipments: 'Shipments', tracking: 'Live tracking', documents: 'Documents',
    performance: 'Performance & SLA', warehouses: 'Warehouses', reports: 'Reports', support: 'Support',
    active: 'Active shipments', transit: 'In transit', delivered: 'Delivered', attention: 'Needs your attention',
    docReady: 'Document ready', operationalHealth: 'Operational health', refreshed: 'Last refreshed',
    needsAction: 'Needs your attention', actionHint: 'Prioritized issues that may affect delivery or closure.',
    noAction: 'Everything looks clear. No open issues require attention.', recent: 'Recent shipments', viewAll: 'View all',
    search: 'Search mission, route, warehouse…', allStatuses: 'All statuses', allWarehouses: 'All warehouses',
    mission: 'Mission', route: 'Route', warehouse: 'Warehouse', status: 'Status', schedule: 'Scheduled',
    progress: 'Delivery progress', assignment: 'Driver / carrier', details: 'View details', notAssigned: 'Not assigned',
    notScheduled: 'Not scheduled', empty: 'No matching shipments.', loading: 'Loading your logistics workspace…',
    unavailable: 'Customer workspace is unavailable', retry: 'Try again', stops: 'stops completed',
    lastUpdate: 'Last operational update', locationUnavailable: 'Live GPS is not connected', nextStop: 'Next stop',
    documentReadiness: 'Delivery document readiness', ready: 'Ready', pending: 'Pending', notApplicable: 'Not due',
    missingRequirements: 'Missing requirements', performanceTitle: 'Current operational indicators',
    performanceNote: 'Calculated from the currently visible shipment data. Historical SLA trends require published KPI snapshots.',
    completion: 'Stop completion', exceptionFree: 'Exception-free shipments', closureReady: 'Closure readiness',
    warehouseHealth: 'Warehouse activity', activeLoads: 'active shipments', issues: 'open issues',
    exportTitle: 'Download operational report', exportHint: 'Export the current shipment view as a CSV file for Excel.',
    export: 'Export CSV', supportTitle: 'Support center', supportHint: 'Start from a shipment to keep every request traceable.',
    contactOps: 'Select a shipment and use its details to review the issue context. Ticket creation for customer accounts will be enabled when the support workflow is approved.',
    high: 'High priority', warning: 'Warning', blocking: 'Blocks closure', openIssue: 'Open issue',
  },
  'ar-SA': {
    eyebrow: 'مركز قيادة العميل', title: 'عملياتك اللوجستية أمامك بوضوح',
    subtitle: 'تابع الشحنات، تعامل مع الحالات المهمة، وتحقق من جاهزية مستندات التسليم من مساحة واحدة.',
    overview: 'الرئيسية', shipments: 'الشحنات', tracking: 'التتبع الحي', documents: 'المستندات',
    performance: 'الأداء وSLA', warehouses: 'المستودعات', reports: 'التقارير', support: 'الدعم',
    active: 'الشحنات النشطة', transit: 'قيد النقل', delivered: 'تم التسليم', attention: 'تحتاج تدخلك',
    docReady: 'المستندات جاهزة', operationalHealth: 'سلامة العمليات', refreshed: 'آخر تحديث',
    needsAction: 'تحتاج تدخلك', actionHint: 'حالات مرتبة حسب الأولوية وقد تؤثر في التسليم أو إغلاق الشحنة.',
    noAction: 'كل شيء واضح، ولا توجد حالات مفتوحة تحتاج إلى تدخل.', recent: 'أحدث الشحنات', viewAll: 'عرض الكل',
    search: 'ابحث برقم المهمة أو المسار أو المستودع…', allStatuses: 'كل الحالات', allWarehouses: 'كل المستودعات',
    mission: 'المهمة', route: 'المسار', warehouse: 'المستودع', status: 'الحالة', schedule: 'الموعد',
    progress: 'تقدم التسليم', assignment: 'السائق / شركة النقل', details: 'عرض التفاصيل', notAssigned: 'غير مسند',
    notScheduled: 'غير مجدولة', empty: 'لا توجد شحنات مطابقة.', loading: 'جارٍ تحميل مساحة عملياتك…',
    unavailable: 'تعذر تحميل بوابة العميل', retry: 'إعادة المحاولة', stops: 'محطة مكتملة',
    lastUpdate: 'آخر تحديث تشغيلي', locationUnavailable: 'التتبع الحي GPS غير متصل', nextStop: 'المحطة التالية',
    documentReadiness: 'جاهزية مستندات التسليم', ready: 'جاهزة', pending: 'غير مكتملة', notApplicable: 'لم تستحق بعد',
    missingRequirements: 'متطلبات ناقصة', performanceTitle: 'مؤشرات التشغيل الحالية',
    performanceNote: 'محسوبة من بيانات الشحنات الظاهرة حاليًا. الاتجاهات التاريخية لـSLA تتطلب نشر لقطات KPI المعتمدة.',
    completion: 'اكتمال المحطات', exceptionFree: 'شحنات بلا استثناءات', closureReady: 'جاهزية الإغلاق',
    warehouseHealth: 'نشاط المستودعات', activeLoads: 'شحنة نشطة', issues: 'حالة مفتوحة',
    exportTitle: 'تنزيل التقرير التشغيلي', exportHint: 'صدّر عرض الشحنات الحالي بصيغة CSV المتوافقة مع Excel.',
    export: 'تصدير CSV', supportTitle: 'مركز الدعم', supportHint: 'ابدأ من الشحنة حتى يبقى كل طلب مرتبطًا بسياقه.',
    contactOps: 'اختر شحنة وافتح تفاصيلها لمراجعة سياق المشكلة. سيتم تفعيل إنشاء التذاكر لحسابات العملاء بعد اعتماد مسار عمل الدعم.',
    high: 'أولوية عالية', warning: 'تحذير', blocking: 'يمنع الإغلاق', openIssue: 'حالة مفتوحة',
  },
} as const;

export function ClientPortalDashboard({ accessToken }: { accessToken: string }) {
  const { locale } = useI18n();
  const text = copy[locale];
  const [data, setData] = useState<ControlTowerResponse>();
  const [tab, setTab] = useState<Tab>('overview');
  const [selectedMissionId, setSelectedMissionId] = useState<string>();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [error, setError] = useState<string>();
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ page: '1', limit: '100' });
    void getControlTower(accessToken, query, controller.signal).then((response) => {
      setData(response); setError(undefined);
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof ApiRequestError ? cause.message : text.unavailable);
    });
    return () => controller.abort();
  }, [accessToken, revision, text.unavailable]);

  const missions = useMemo(() => data?.data ?? [], [data]);
  const filtered = useMemo(() => missions.filter((mission) => {
    const needle = search.trim().toLocaleLowerCase(locale);
    const matchesSearch = !needle || [mission.missionNo, mission.route?.name, mission.warehouse.name, mission.carrier?.name]
      .some((value) => value?.toLocaleLowerCase(locale).includes(needle));
    return matchesSearch && (!status || mission.status === status) && (!warehouseId || mission.warehouse.id === warehouseId);
  }), [locale, missions, search, status, warehouseId]);
  const active = missions.filter((mission) => !terminalStatuses.includes(mission.status as typeof terminalStatuses[number]));
  const exceptions = missions.flatMap((mission) => mission.openExceptions.map((issue) => ({ mission, issue })))
    .sort((a, b) => severityRank(b.issue.severity) - severityRank(a.issue.severity));
  const delivered = missions.filter((mission) => ['DELIVERED', 'OPERATIONALLY_CLOSED', 'ACCOUNTING_READY', 'CLOSED'].includes(mission.status));
  const closureApplicable = missions.filter((mission) => mission.closureReadiness.applicable);
  const closureReady = closureApplicable.filter((mission) => mission.closureReadiness.applicable && mission.closureReadiness.ready).length;
  const totalStops = missions.reduce((sum, mission) => sum + mission.stopProgress.total, 0);
  const completedStops = missions.reduce((sum, mission) => sum + mission.stopProgress.completed, 0);
  const health = active.length ? Math.round(((active.length - new Set(exceptions.map(({ mission }) => mission.id)).size) / active.length) * 100) : 100;
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'overview', label: text.overview }, { id: 'shipments', label: text.shipments },
    { id: 'tracking', label: text.tracking }, { id: 'documents', label: text.documents },
    { id: 'performance', label: text.performance }, { id: 'warehouses', label: text.warehouses },
    { id: 'reports', label: text.reports }, { id: 'support', label: text.support },
  ];

  return <main className="client-command-center">
    <header className="client-command-hero">
      <div><p className="eyebrow">{text.eyebrow}</p><h1>{text.title}</h1><p>{text.subtitle}</p></div>
      <div className="client-health"><span>{text.operationalHealth}</span><strong>{health}%</strong><small>{text.refreshed}: {new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</small></div>
    </header>

    <nav className="client-command-tabs" aria-label={text.eyebrow}>
      {tabs.map((item) => <button className={tab === item.id ? 'active' : ''} key={item.id} onClick={() => setTab(item.id)} type="button">{item.label}</button>)}
    </nav>

    {error ? <section className="state-panel error-state" role="alert"><strong>{text.unavailable}</strong><span>{error}</span><button className="quiet-button" onClick={() => setRevision((value) => value + 1)}>{text.retry}</button></section> : null}
    {!data && !error ? <section className="state-panel" role="status">{text.loading}</section> : null}

    {data && tab === 'overview' ? <>
      <section className="client-kpi-grid" aria-label={text.overview}>
        <Kpi label={text.active} value={active.length} tone="wine" />
        <Kpi label={text.transit} value={missions.filter((mission) => inTransitStatuses.includes(mission.status as typeof inTransitStatuses[number])).length} tone="blue" />
        <Kpi label={text.delivered} value={delivered.length} tone="green" />
        <Kpi label={text.attention} value={new Set(exceptions.map(({ mission }) => mission.id)).size} tone="amber" />
        <Kpi label={text.docReady} value={`${closureReady}/${closureApplicable.length}`} tone="violet" />
      </section>
      <section className="client-overview-grid">
        <div className="client-section client-action-section"><SectionTitle title={text.needsAction} hint={text.actionHint} count={exceptions.length} />
          {exceptions.length ? <div className="client-action-list">{exceptions.slice(0, 5).map(({ mission, issue }) => <button key={issue.id} onClick={() => setSelectedMissionId(mission.id)} type="button"><span className={`issue-dot severity-${issue.severity?.toLowerCase() ?? 'warning'}`} /><div><strong>{issue.definition.name}</strong><small>{mission.missionNo} · {issue.stop?.branch.name ?? mission.route?.name ?? mission.warehouse.name}</small></div><em>{issue.isBlocking ? text.blocking : issue.severity === 'HIGH' || issue.severity === 'CRITICAL' ? text.high : text.warning}</em></button>)}</div> : <div className="client-clear-state"><span>✓</span><p>{text.noAction}</p></div>}
        </div>
        <div className="client-section"><SectionTitle title={text.recent} hint={`${missions.length} ${text.shipments}`} action={text.viewAll} onAction={() => setTab('shipments')} />
          <div className="client-recent-list">{missions.slice(0, 5).map((mission) => <button key={mission.id} onClick={() => setSelectedMissionId(mission.id)} type="button"><div><strong>{mission.missionNo}</strong><small>{mission.route?.name ?? mission.warehouse.name}</small></div><Status mission={mission} locale={locale} /><b>{progress(mission)}%</b></button>)}</div>
        </div>
      </section>
    </> : null}

    {data && tab === 'shipments' ? <section className="client-section"><SectionTitle title={text.shipments} hint={`${filtered.length} / ${missions.length}`} /><Filters {...{ search, setSearch, status, setStatus, warehouseId, setWarehouseId, data, text }} />{filtered.length ? <div className="client-shipment-table">{filtered.map((mission) => <ShipmentRow key={mission.id} mission={mission} locale={locale} text={text} onOpen={() => setSelectedMissionId(mission.id)} />)}</div> : <div className="state-panel">{text.empty}</div>}</section> : null}

    {data && tab === 'tracking' ? <section className="client-section"><SectionTitle title={text.tracking} hint={text.locationUnavailable} /><div className="client-tracking-board"><div className="client-map-placeholder"><div className="map-grid" /><span className="map-pin">W</span><strong>{text.locationUnavailable}</strong><small>{text.lastUpdate}: —</small></div><div className="client-tracking-cards">{active.slice(0, 8).map((mission) => <button key={mission.id} onClick={() => setSelectedMissionId(mission.id)} type="button"><div><strong>{mission.missionNo}</strong><Status mission={mission} locale={locale} /></div><p>{mission.route?.name ?? mission.warehouse.name}</p><div className="tracking-line"><span style={{ width: `${progress(mission)}%` }} /></div><small>{text.nextStop}: {mission.mapStops.find((stop) => stop.status === 'PENDING')?.branch.name ?? '—'}</small></button>)}</div></div></section> : null}

    {data && tab === 'documents' ? <section className="client-section"><SectionTitle title={text.documentReadiness} hint={`${closureReady}/${closureApplicable.length} ${text.ready}`} /><div className="client-document-grid">{missions.map((mission) => { const readiness = mission.closureReadiness; const state = !readiness.applicable ? 'na' : readiness.ready ? 'ready' : 'pending'; return <button key={mission.id} onClick={() => setSelectedMissionId(mission.id)} type="button"><div><strong>{mission.missionNo}</strong><small>{mission.warehouse.name}</small></div><span className={`document-state ${state}`}>{state === 'ready' ? text.ready : state === 'pending' ? text.pending : text.notApplicable}</span>{readiness.applicable && !readiness.ready ? <p>{readiness.missing.length} {text.missingRequirements}</p> : <p>—</p>}</button>; })}</div></section> : null}

    {data && tab === 'performance' ? <section className="client-section"><SectionTitle title={text.performanceTitle} hint={text.performanceNote} /><div className="client-performance-grid"><Gauge label={text.completion} value={percent(completedStops, totalStops)} /><Gauge label={text.exceptionFree} value={percent(missions.length - new Set(exceptions.map(({ mission }) => mission.id)).size, missions.length)} /><Gauge label={text.closureReady} value={percent(closureReady, closureApplicable.length)} /></div></section> : null}

    {data && tab === 'warehouses' ? <section className="client-section"><SectionTitle title={text.warehouseHealth} hint={`${data.filterOptions.warehouses.length} ${text.warehouses}`} /><div className="client-warehouse-grid">{data.filterOptions.warehouses.map((warehouse) => { const related = missions.filter((mission) => mission.warehouse.id === warehouse.id); const issueCount = related.reduce((sum, mission) => sum + mission.openExceptions.length, 0); return <button key={warehouse.id} onClick={() => { setWarehouseId(warehouse.id); setTab('shipments'); }} type="button"><span>{warehouse.code}</span><strong>{warehouse.name}</strong><dl><div><dt>{text.activeLoads}</dt><dd>{related.length}</dd></div><div><dt>{text.issues}</dt><dd>{issueCount}</dd></div></dl></button>; })}</div></section> : null}

    {data && tab === 'reports' ? <section className="client-section client-export-panel"><div className="export-art"><span>↓</span></div><div><h2>{text.exportTitle}</h2><p>{text.exportHint}</p><button className="primary-button" onClick={() => exportCsv(filtered, locale)} type="button">{text.export}</button></div></section> : null}

    {data && tab === 'support' ? <section className="client-section client-support-panel"><div><p className="eyebrow">WAFI SUPPORT</p><h2>{text.supportTitle}</h2><p>{text.supportHint}</p></div><aside><strong>{text.openIssue}</strong><p>{text.contactOps}</p><button className="quiet-button" onClick={() => setTab('shipments')} type="button">{text.shipments}</button></aside></section> : null}

    {selectedMissionId ? <MissionDetailPanel accessToken={accessToken} missionId={selectedMissionId} onClose={() => setSelectedMissionId(undefined)} onChanged={() => setRevision((value) => value + 1)} enableWorkflow={false} /> : null}
  </main>;
}

function Kpi({ label, value, tone }: { label: string; value: string | number; tone: string }) { return <article className={`client-kpi tone-${tone}`}><span>{label}</span><strong>{value}</strong><i aria-hidden="true" /></article>; }
function SectionTitle({ title, hint, count, action, onAction }: { title: string; hint: string; count?: number; action?: string; onAction?: () => void }) { return <header className="client-section-title"><div><h2>{title}{count !== undefined ? <span>{count}</span> : null}</h2><p>{hint}</p></div>{action ? <button onClick={onAction} type="button">{action}</button> : null}</header>; }
function Status({ mission, locale }: { mission: ControlTowerMission; locale: 'en' | 'ar-SA' }) { return <span className={`status-badge status-${mission.status.toLowerCase()}`}>{translateVisibleText(mission.status.replaceAll('_', ' '), locale)}</span>; }
function progress(mission: ControlTowerMission) { return percent(mission.stopProgress.completed, mission.stopProgress.total); }
function percent(value: number, total: number) { return total ? Math.round((value / total) * 100) : 0; }
function severityRank(severity: string | null) { return ({ CRITICAL: 4, HIGH: 3, WARNING: 2, INFO: 1 } as Record<string, number>)[severity ?? ''] ?? 0; }

function Filters({ search, setSearch, status, setStatus, warehouseId, setWarehouseId, data, text }: { search: string; setSearch: (v: string) => void; status: string; setStatus: (v: string) => void; warehouseId: string; setWarehouseId: (v: string) => void; data: ControlTowerResponse; text: typeof copy[keyof typeof copy] }) { return <div className="client-filters"><input aria-label={text.search} placeholder={text.search} value={search} onChange={(event) => setSearch(event.target.value)} /><select aria-label={text.status} value={status} onChange={(event) => setStatus(event.target.value)}><option value="">{text.allStatuses}</option>{Object.keys(data.summary.byStatus).map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select><select aria-label={text.warehouse} value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}><option value="">{text.allWarehouses}</option>{data.filterOptions.warehouses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>; }

function ShipmentRow({ mission, locale, text, onOpen }: { mission: ControlTowerMission; locale: 'en' | 'ar-SA'; text: typeof copy[keyof typeof copy]; onOpen: () => void }) { return <button className="client-shipment-row" onClick={onOpen} type="button"><div><small>{text.mission}</small><strong>{mission.missionNo}</strong></div><div><small>{text.route}</small><strong>{mission.route?.name ?? '—'}</strong></div><div><small>{text.warehouse}</small><strong>{mission.warehouse.name}</strong></div><div><small>{text.progress}</small><strong>{progress(mission)}%</strong></div><Status mission={mission} locale={locale} /><span className="row-arrow">‹</span></button>; }

function Gauge({ label, value }: { label: string; value: number }) { return <article><div className="client-gauge" style={{ background: `conic-gradient(#b41431 ${value * 3.6}deg, #eee8ea 0deg)` }}><span>{value}%</span></div><strong>{label}</strong></article>; }

function exportCsv(missions: ControlTowerMission[], locale: string) {
  const rows = [['Mission', 'Status', 'Route', 'Warehouse', 'Carrier', 'Progress', 'Open exceptions'], ...missions.map((mission) => [mission.missionNo, mission.status, mission.route?.name ?? '', mission.warehouse.name, mission.carrier?.name ?? '', `${progress(mission)}%`, String(mission.openExceptions.length)])];
  const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `wafi-client-report-${new Date().toLocaleDateString(locale).replaceAll('/', '-')}.csv`; anchor.click(); URL.revokeObjectURL(url);
}
