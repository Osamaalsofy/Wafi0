'use client';

import { useEffect, useMemo, useState } from 'react';
import { ApiRequestError, getControlTower, getCurrentDriverMissions } from '../../lib/api-client';
import { useI18n } from '../../i18n/i18n-provider';
import { MissionDetailPanel } from '../control-tower/mission-detail-panel';
import type { ControlTowerMission, ControlTowerResponse } from '../control-tower/types';
import type { MissionListItem, PaginatedMissions } from '../missions/types';
import { useSession } from '../auth/session-provider';
import { translateVisibleText } from '../../i18n/localized-surface';
import { ClientPortalDashboard } from './client-portal-dashboard';

type PortalKind = 'client' | 'driver';
type ClientPortalTab = 'shipments' | 'warehouses' | 'drivers' | 'tracking';
type DriverPeriod = 'current' | 'today' | 'week';

const copy = {
  en: {
    clientEyebrow: 'CUSTOMER PORTAL',
    clientTitle: 'Shipment visibility',
    clientSubtitle: 'Track active missions, delivery progress, and document readiness in one place.',
    driverEyebrow: 'DRIVER PORTAL',
    driverTitle: 'My assigned work',
    driverSubtitle: 'A focused daily view of assigned missions, vehicles, routes, and stops.',
    active: 'Active missions',
    transit: 'In transit',
    delivered: 'Delivered',
    attention: 'Needs attention',
    assignments: 'Current assignments',
    shipments: 'Current shipments',
    warehouses: 'Warehouses',
    warehouse: 'Warehouse',
    allWarehouses: 'All warehouses',
    warehouseShipments: 'active shipments',
    drivers: 'Drivers',
    tracking: 'Shipment tracking',
    trackingNumber: 'Tracking number',
    phone: 'Phone',
    carrier: 'Carrier',
    noDrivers: 'No drivers are assigned to this client.',
    progress: 'Delivery progress',
    stopsCompleted: 'stops completed',
    loading: 'Loading portal data…',
    empty: 'No matching active missions.',
    unavailable: 'Portal data is unavailable',
    retry: 'Retry',
    mission: 'Mission',
    status: 'Status',
    route: 'Route',
    assignment: 'Assignment',
    schedule: 'Schedule',
    details: 'View details',
    unassigned: 'Not assigned',
    notScheduled: 'Not scheduled',
    driverNotice:
      'Only missions assigned to the driver linked to your account are shown here.',
    current: 'Current trip', today: "Today's trips", week: 'Weekly trips', tripCount: 'Trips', associatedClient: 'Client',
  },
  'ar-SA': {
    clientEyebrow: 'بوابة العميل',
    clientTitle: 'متابعة الشحنات',
    clientSubtitle: 'تابع المهام النشطة وتقدم التسليم وجاهزية المستندات من مكان واحد.',
    driverEyebrow: 'بوابة السائق',
    driverTitle: 'مهامي المسندة',
    driverSubtitle: 'عرض يومي مبسط للمهام والمركبات والمسارات ومحطات التسليم.',
    active: 'المهام النشطة',
    transit: 'قيد النقل',
    delivered: 'تم التسليم',
    attention: 'تحتاج متابعة',
    assignments: 'التكليفات الحالية',
    shipments: 'الشحنات الحالية',
    warehouses: 'المستودعات',
    warehouse: 'المستودع',
    allWarehouses: 'كل المستودعات',
    warehouseShipments: 'شحنة نشطة',
    drivers: 'السائقون',
    tracking: 'تتبع الشحنات',
    trackingNumber: 'رقم التتبع',
    phone: 'رقم الجوال',
    carrier: 'شركة النقل',
    noDrivers: 'لا يوجد سائقون مرتبطون بالعميل.',
    progress: 'تقدم التسليم',
    stopsCompleted: 'محطة مكتملة',
    loading: 'جارٍ تحميل بيانات البوابة…',
    empty: 'لا توجد مهام نشطة مطابقة.',
    unavailable: 'بيانات البوابة غير متاحة',
    retry: 'إعادة المحاولة',
    mission: 'المهمة',
    status: 'الحالة',
    route: 'المسار',
    assignment: 'التكليف',
    schedule: 'الموعد',
    details: 'عرض التفاصيل',
    unassigned: 'غير مسند',
    notScheduled: 'غير مجدولة',
    driverNotice:
      'تظهر هنا فقط المهام المسندة إلى السائق المرتبط بحسابك.',
    current: 'الرحلة الحالية', today: 'رحلات اليوم', week: 'رحلات الأسبوع', tripCount: 'الرحلات', associatedClient: 'العميل',
  },
} as const;

export function PortalDashboard({ accessToken, kind }: { accessToken: string; kind: PortalKind }) {
  return kind === 'client'
    ? <ClientPortalDashboard accessToken={accessToken} />
    : <DriverPortalDashboard accessToken={accessToken} kind={kind} />;
}

function DriverPortalDashboard({ accessToken, kind }: { accessToken: string; kind: PortalKind }) {
  const { locale } = useI18n();
  const { hasPermission } = useSession();
  const text = copy[locale];
  const [data, setData] = useState<ControlTowerResponse>();
  const [driverData, setDriverData] = useState<PaginatedMissions>();
  const [selectedMissionId, setSelectedMissionId] = useState<string>();
  const [warehouseId, setWarehouseId] = useState('');
  const [clientTab, setClientTab] = useState<ClientPortalTab>('shipments');
  const [driverPeriod, setDriverPeriod] = useState<DriverPeriod>('current');
  const [error, setError] = useState<string>();
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ page: '1', limit: '100' });
    const request = kind === 'driver'
      ? getCurrentDriverMissions(accessToken, controller.signal)
      : getControlTower(accessToken, query, controller.signal);
    void request
      .then((response) => {
        if (kind === 'driver') setDriverData(response as PaginatedMissions);
        else setData(response as ControlTowerResponse);
        setError(undefined);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(cause instanceof ApiRequestError ? cause.message : text.unavailable);
      });
    return () => controller.abort();
  }, [accessToken, kind, revision, text.unavailable]);

  const missions = useMemo(
    () => {
      const available = (kind === 'driver' ? driverData?.data : data?.data) ?? [];
      if (kind === 'driver') {
        const now = new Date();
        const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startWeek = new Date(startToday); startWeek.setDate(startToday.getDate() - startToday.getDay());
        if (driverPeriod === 'current') return available.filter((mission) => !['DELIVERED', 'OPERATIONALLY_CLOSED', 'ACCOUNTING_READY', 'CLOSED', 'CANCELLED'].includes(mission.status));
        const lower = driverPeriod === 'today' ? startToday : startWeek;
        return available.filter((mission) => mission.scheduledLoadingAt && new Date(mission.scheduledLoadingAt) >= lower && new Date(mission.scheduledLoadingAt) <= now);
      }
      return kind === 'client' && warehouseId
        ? available.filter((mission) => mission.warehouse.id === warehouseId)
        : available;
    },
    [data, driverData, driverPeriod, kind, warehouseId],
  );
  const counts = useMemo(
    () => ({
      active: missions.length,
      transit: missions.filter((mission) => ['DEPARTED', 'IN_TRANSIT', 'AT_STOP', 'DELIVERING'].includes(mission.status)).length,
      delivered: missions.filter((mission) => mission.status === 'DELIVERED').length,
      attention: missions.filter(
        (mission) => 'openExceptions' in mission && mission.openExceptions.length > 0,
      ).length,
    }),
    [missions],
  );
  const trackedMissions = useMemo(
    () => (data?.data ?? []).filter((mission) => !warehouseId || mission.warehouse.id === warehouseId),
    [data, warehouseId],
  );

  return (
    <main className={`dashboard portal-dashboard portal-${kind}`}>
      <header className="portal-hero">
        <div>
          <p className="eyebrow">{kind === 'client' ? text.clientEyebrow : text.driverEyebrow}</p>
          <h1>{kind === 'client' ? text.clientTitle : text.driverTitle}</h1>
          <p>{kind === 'client' ? text.clientSubtitle : text.driverSubtitle}</p>
        </div>
        <span className="portal-role-mark" aria-hidden="true">{kind === 'client' ? 'C' : 'D'}</span>
      </header>

      {kind === 'driver' ? <p className="portal-notice">{text.driverNotice}</p> : null}

      {kind === 'driver' ? <nav className="portal-tabs" aria-label={text.assignments}>
        {(['current', 'today', 'week'] as const).map((period) => <button className={driverPeriod === period ? 'active' : ''} key={period} onClick={() => setDriverPeriod(period)} type="button">{text[period]}</button>)}
      </nav> : null}

      {kind === 'client' ? (
        <nav className="portal-tabs" aria-label={text.clientEyebrow} role="tablist">
          <button
            aria-controls="client-shipments-panel"
            aria-selected={clientTab === 'shipments'}
            className={clientTab === 'shipments' ? 'active' : ''}
            onClick={() => setClientTab('shipments')}
            role="tab"
            type="button"
          >
            {text.shipments}
          </button>
          <button
            aria-controls="client-warehouses-panel"
            aria-selected={clientTab === 'warehouses'}
            className={clientTab === 'warehouses' ? 'active' : ''}
            onClick={() => setClientTab('warehouses')}
            role="tab"
            type="button"
          >
            {text.warehouses}
          </button>
          <button
            aria-controls="client-drivers-panel"
            aria-selected={clientTab === 'drivers'}
            className={clientTab === 'drivers' ? 'active' : ''}
            onClick={() => setClientTab('drivers')}
            role="tab"
            type="button"
          >
            {text.drivers}
          </button>
          <button
            aria-controls="client-tracking-panel"
            aria-selected={clientTab === 'tracking'}
            className={clientTab === 'tracking' ? 'active' : ''}
            onClick={() => setClientTab('tracking')}
            role="tab"
            type="button"
          >
            {text.tracking}
          </button>
        </nav>
      ) : null}

      {kind === 'client' && clientTab === 'drivers' ? (
        <section className="portal-list-panel" id="client-drivers-panel" role="tabpanel">
          <div className="panel-heading"><div><h2>{text.drivers}</h2><p>{data?.filterOptions.drivers.length ?? 0} {text.drivers}</p></div></div>
          {!data ? <div className="state-panel" role="status">{text.loading}</div> : data.filterOptions.drivers.length === 0 ? (
            <div className="state-panel">{text.noDrivers}</div>
          ) : (
            <div className="portal-driver-grid">
              {data.filterOptions.drivers.map((driver) => (
                <article key={driver.id}>
                  <div className="portal-driver-avatar" aria-hidden="true">{driver.name.slice(0, 1)}</div>
                  <div><strong>{driver.name}</strong><span>{driver.carrier.name}</span></div>
                  <dl>
                    <div><dt>{text.tripCount}</dt><dd>{driver._count.missions}</dd></div>
                    <div><dt>{text.associatedClient}</dt><dd>{driver.client?.name ?? text.unassigned}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {kind === 'client' && clientTab === 'tracking' ? (
        <section className="portal-list-panel" id="client-tracking-panel" role="tabpanel">
          <div className="panel-heading"><div><h2>{text.tracking}</h2><p>{trackedMissions.length} {text.active}</p></div></div>
          {!data ? <div className="state-panel" role="status">{text.loading}</div> : trackedMissions.length === 0 ? (
            <div className="state-panel">{text.empty}</div>
          ) : (
            <div className="portal-tracking-list">
              {trackedMissions.map((mission) => {
                const completed = mission.stopProgress.completed;
                const total = mission.stopProgress.total;
                const percentage = total ? Math.round((completed / total) * 100) : 0;
                return (
                  <article key={mission.id}>
                    <div className="portal-tracking-title"><div><small>{text.mission}</small><strong>{mission.missionNo}</strong></div><span className={`status-badge status-${mission.status.toLowerCase()}`}>{translateVisibleText(mission.status.replaceAll('_', ' '), locale)}</span></div>
                    <div className="progress-label"><span>{text.progress}</span><b>{percentage}%</b></div>
                    <div className="portal-tracking-progress"><span style={{ width: `${percentage}%` }} /></div>
                    <p>{completed} / {total} {text.stopsCompleted}</p>
                    <dl><div><dt>{text.drivers}</dt><dd>{mission.driver?.name ?? text.unassigned}</dd></div><div><dt>{text.trackingNumber}</dt><dd>{mission.driver?.trackingNumber ?? text.unassigned}</dd></div><div><dt>{text.warehouse}</dt><dd>{mission.warehouse.name}</dd></div></dl>
                    <button className="quiet-button" onClick={() => setSelectedMissionId(mission.id)}>{text.details}</button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {kind === 'client' && clientTab === 'warehouses' ? (
        <section
          className="portal-warehouses"
          id="client-warehouses-panel"
          aria-labelledby="portal-warehouses-title"
          role="tabpanel"
        >
          {!data ? <div className="state-panel" role="status">{text.loading}</div> : (
            <>
          <div className="panel-heading portal-warehouse-heading">
            <div>
              <h2 id="portal-warehouses-title">{text.warehouses}</h2>
              <p>{data.filterOptions.warehouses.length} {text.warehouses}</p>
            </div>
            <label>
              <span>{text.warehouse}</span>
              <select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
                <option value="">{text.allWarehouses}</option>
                {data.filterOptions.warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="portal-warehouse-grid">
            {data.filterOptions.warehouses.map((warehouse) => {
              const activeShipments = data.data.filter((mission) => mission.warehouse.id === warehouse.id).length;
              return (
                <button
                  className={warehouseId === warehouse.id ? 'selected' : ''}
                  key={warehouse.id}
                  onClick={() => setWarehouseId((current) => current === warehouse.id ? '' : warehouse.id)}
                  type="button"
                >
                  <span>{warehouse.code}</span>
                  <strong>{warehouse.name}</strong>
                  <small>{activeShipments} {text.warehouseShipments}</small>
                </button>
              );
            })}
          </div>
            </>
          )}
        </section>
      ) : null}

      {kind === 'driver' || clientTab === 'shipments' ? <>
      <section className="portal-metrics" aria-label={kind === 'client' ? text.shipments : text.assignments}>
        <Metric label={text.active} value={counts.active} />
        <Metric label={text.transit} value={counts.transit} />
        <Metric label={text.delivered} value={counts.delivered} />
        <Metric label={text.attention} value={counts.attention} attention />
      </section>

      <section
        className="portal-list-panel"
        id={kind === 'client' ? 'client-shipments-panel' : undefined}
        role={kind === 'client' ? 'tabpanel' : undefined}
      >
        <div className="panel-heading">
          <div>
            <h2>{kind === 'client' ? text.shipments : text.assignments}</h2>
            <p>{missions.length} {text.active}</p>
          </div>
        </div>
        {error ? (
          <div className="state-panel error-state" role="alert">
            <strong>{text.unavailable}</strong><span>{error}</span>
            <button className="quiet-button" onClick={() => setRevision((value) => value + 1)}>{text.retry}</button>
          </div>
        ) : !(kind === 'driver' ? driverData : data) ? <div className="state-panel" role="status">{text.loading}</div> : missions.length === 0 ? (
          <div className="state-panel">{text.empty}</div>
        ) : (
          <div className="portal-mission-grid">
            {missions.map((mission) => (
              <MissionCard key={mission.id} mission={mission} text={text} locale={locale} onOpen={() => setSelectedMissionId(mission.id)} />
            ))}
          </div>
        )}
      </section>
      </> : null}

      {selectedMissionId ? (
        <MissionDetailPanel
          accessToken={accessToken}
          missionId={selectedMissionId}
          onClose={() => setSelectedMissionId(undefined)}
          onChanged={() => setRevision((value) => value + 1)}
          enableWorkflow={kind === 'driver' && hasPermission('mission.update')}
        />
      ) : null}
    </main>
  );
}

function Metric({ label, value, attention = false }: { label: string; value: number; attention?: boolean }) {
  return <article className={attention ? 'attention' : ''}><span>{label}</span><strong>{value}</strong></article>;
}

function MissionCard({ mission, text, locale, onOpen }: { mission: ControlTowerMission | MissionListItem; text: (typeof copy)[keyof typeof copy]; locale: 'en' | 'ar-SA'; onOpen: () => void }) {
  return (
    <article className="portal-mission-card">
      <div className="portal-card-top"><div><small>{text.mission}</small><strong>{mission.missionNo}</strong></div><span className={`status-badge status-${mission.status.toLowerCase()}`}>{translateVisibleText(mission.status.replaceAll('_', ' '), locale)}</span></div>
      <dl>
        <div><dt>{text.route}</dt><dd>{mission.route?.name ?? text.unassigned}</dd></div>
        <div><dt>{text.warehouse}</dt><dd>{mission.warehouse.name}</dd></div>
        <div><dt>{text.assignment}</dt><dd>{mission.driver?.name ?? mission.carrier?.name ?? text.unassigned}</dd></div>
        <div><dt>{text.schedule}</dt><dd>{mission.scheduledLoadingAt ? new Date(mission.scheduledLoadingAt).toLocaleString(locale) : text.notScheduled}</dd></div>
      </dl>
      <button className="primary-button" onClick={onOpen}>{text.details}</button>
    </article>
  );
}
