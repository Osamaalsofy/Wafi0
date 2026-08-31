'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiRequestError, getControlTower, listResource } from '../../lib/api-client';
import { useI18n } from '../../i18n/i18n-provider';
import { useSession } from '../auth/session-provider';
import { ExceptionWorkspace } from '../exceptions/exception-workspace';
import { AttentionPanel } from './components/attention-panel';
import { ControlTowerMap } from './components/control-tower-map';
import { LiveOperations } from './components/live-operations';
import { OperationsKpiStrip } from './components/operations-kpi-strip';
import { TodayFlow } from './components/today-flow';
import { useControlTowerMap } from './hooks/use-control-tower-map';
import { useMapLayers } from './hooks/use-map-layers';
import { MissionDetailPanel } from './mission-detail-panel';
import type { ControlTowerResponse } from './types';

export function ControlTowerDashboard({
  ...props
}: {
  accessToken: string;
  onLogout: () => void;
  embedded?: boolean;
}) {
  const { accessToken } = props;
  const { locale } = useI18n();
  const { hasPermission } = useSession();
  const arabic = locale === 'ar-SA';
  const [data, setData] = useState<ControlTowerResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [clientId, setClientId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [carrierId, setCarrierId] = useState('');
  const [revision, setRevision] = useState(0);
  const [pollingSeconds, setPollingSeconds] = useState(60);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date>();
  const [selectedMissionId, setSelectedMissionId] = useState<string>();
  const [selectedExceptionId, setSelectedExceptionId] = useState<string>();
  const [exceptionWorkspaceOpen, setExceptionWorkspaceOpen] = useState(false);
  const [referenceLocations, setReferenceLocations] = useState<Array<{ id: string; code: string; nameAr: string; nameEn: string; latitude: string; longitude: string; isMajor: boolean }>>([]);
  const [focusLocationId, setFocusLocationId] = useState('');
  const { visibleLayers, toggleLayer } = useMapLayers();
  const mapModel = useControlTowerMap(data?.data ?? [], referenceLocations, arabic);
  const closeMissionDetail = useCallback(() => setSelectedMissionId(undefined), []);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ page: '1', limit: '100' });
    if (search) query.set('search', search);
    if (status) query.set('status', status);
    if (clientId) query.set('clientId', clientId);
    if (warehouseId) query.set('warehouseId', warehouseId);
    if (carrierId) query.set('carrierId', carrierId);
    void getControlTower(accessToken, query, controller.signal)
      .then((response) => {
        setData(response);
        setError(undefined);
        setLastUpdatedAt(new Date());
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(cause instanceof ApiRequestError ? cause.message : 'Unable to load operations');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [accessToken, carrierId, clientId, revision, search, status, warehouseId]);

  useEffect(() => {
    if (!hasPermission('geography.read')) return;
    const controller = new AbortController();
    void listResource<(typeof referenceLocations)[number]>(accessToken, '/governorates', new URLSearchParams({ page: '1', limit: '100' }), controller.signal)
      .then((response) => setReferenceLocations(response.data))
      .catch(() => setReferenceLocations([]));
    return () => controller.abort();
  }, [accessToken, hasPermission]);

  useEffect(() => {
    if (!pollingSeconds || selectedMissionId || exceptionWorkspaceOpen) return;
    const timer = window.setInterval(() => setRevision((value) => value + 1), pollingSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [exceptionWorkspaceOpen, pollingSeconds, selectedMissionId]);

  const warehouseOptions = useMemo(
    () => data?.filterOptions.warehouses.filter((warehouse) => !clientId || warehouse.clientId === clientId) ?? [],
    [clientId, data],
  );

  function openException(id: string) {
    if (!hasPermission('exception.read')) return;
    setSelectedExceptionId(id);
    setExceptionWorkspaceOpen(true);
  }

  return (
    <main className="command-center" id="operations">
      <header className="command-header">
        <div>
          <p className="eyebrow">WAFI · {arabic ? 'مركز النقل الذكي' : 'INTELLIGENT TRANSPORTATION'}</p>
          <h1>{arabic ? 'برج المراقبة' : 'Control Tower'}</h1>
          <p>{arabic ? 'صورة تشغيلية موحدة لحركة النقل في المملكة العربية السعودية' : 'A unified operational picture of transportation across Saudi Arabia'}</p>
        </div>
        <div className="command-header-actions">
          <label className="refresh-select"><span>{arabic ? 'التحديث' : 'Refresh'}</span><select aria-label="Automatic refresh interval" value={pollingSeconds} onChange={(event) => setPollingSeconds(Number(event.target.value))}><option value={0}>{arabic ? 'يدوي' : 'Manual'}</option><option value={30}>30s</option><option value={60}>60s</option></select></label>
          <button className="command-refresh" disabled={loading} onClick={() => { setLoading(true); setRevision((value) => value + 1); }}>{loading ? (arabic ? 'جارٍ التحديث…' : 'Refreshing…') : (arabic ? 'تحديث الآن' : 'Refresh now')}</button>
          <small aria-live="polite">{lastUpdatedAt ? `${arabic ? 'آخر تحديث' : 'Updated'} ${lastUpdatedAt.toLocaleTimeString(arabic ? 'ar-SA' : 'en', { hour: '2-digit', minute: '2-digit' })}` : (arabic ? 'بانتظار البيانات' : 'Awaiting data')}</small>
        </div>
      </header>

      {error ? <section className="state-panel error-state" role="alert"><strong>{arabic ? 'برج المراقبة غير متاح' : 'Control Tower unavailable'}</strong><span>{error}</span><button className="quiet-button" onClick={() => { setLoading(true); setRevision((value) => value + 1); }}>{arabic ? 'إعادة المحاولة' : 'Try again'}</button></section> : null}

      <OperationsKpiStrip data={data} arabic={arabic} />

      <form className="command-filters" onSubmit={(event) => { event.preventDefault(); setLoading(true); setSearch(searchInput.trim()); setRevision((value) => value + 1); }}>
        <label className="command-search"><span className="sr-only">{arabic ? 'البحث في المهام' : 'Search missions'}</span><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={arabic ? 'رقم المهمة أو نوع الحمولة' : 'Mission number or cargo'} /></label>
        <label><span className="sr-only">{arabic ? 'حالة المهمة' : 'Mission status'}</span><select aria-label="Mission status" value={status} onChange={(event) => { setLoading(true); setStatus(event.target.value); }}><option value="">{arabic ? 'جميع الحالات النشطة' : 'All active statuses'}</option><option value="IN_TRANSIT">{arabic ? 'قيد النقل' : 'In transit'}</option><option value="LOADING">{arabic ? 'قيد التحميل' : 'Loading'}</option><option value="DELIVERED">{arabic ? 'تم التسليم' : 'Delivered'}</option></select></label>
        <label><span className="sr-only">{arabic ? 'العميل' : 'Client'}</span><select aria-label="Client" value={clientId} onChange={(event) => { setLoading(true); setClientId(event.target.value); setWarehouseId(''); }}><option value="">{arabic ? 'كل العملاء' : 'All clients'}</option>{data?.filterOptions.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
        <label><span className="sr-only">{arabic ? 'المستودع' : 'Warehouse'}</span><select aria-label="Warehouse" value={warehouseId} onChange={(event) => { setLoading(true); setWarehouseId(event.target.value); }}><option value="">{arabic ? 'كل المستودعات' : 'All warehouses'}</option>{warehouseOptions.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label>
        <label><span className="sr-only">{arabic ? 'شركة النقل' : 'Carrier'}</span><select aria-label="Carrier" value={carrierId} onChange={(event) => { setLoading(true); setCarrierId(event.target.value); }}><option value="">{arabic ? 'كل شركات النقل' : 'All carriers'}</option>{data?.filterOptions.carriers.map((carrier) => <option key={carrier.id} value={carrier.id}>{carrier.name}</option>)}</select></label>
        <button type="submit">{arabic ? 'تطبيق' : 'Apply'}</button>
      </form>

      <div className={`command-map-grid ${hasPermission('exception.read') ? '' : 'without-attention'}`}>
        <ControlTowerMap model={mapModel} arabic={arabic} visibleLayers={visibleLayers} onToggleLayer={toggleLayer} onSelectMission={setSelectedMissionId} locations={referenceLocations} focusLocationId={focusLocationId} onFocusLocation={setFocusLocationId} />
        {hasPermission('exception.read') ? <AttentionPanel missions={data?.data ?? []} arabic={arabic} onOpenException={openException} /> : null}
      </div>

      <LiveOperations missions={data?.data ?? []} arabic={arabic} onSelectMission={setSelectedMissionId} onSelectException={openException} />
      <TodayFlow data={data} arabic={arabic} />

      <footer className="command-data-note">{arabic ? 'المواقع المعروضة تعتمد على إحداثيات المنشآت أو موقع المدينة التقريبي. لا تتوفر GPS أو ETA مباشرة.' : 'Displayed locations use facility coordinates or an approximate route-city fallback. Live GPS and ETA are not connected.'}</footer>

      {selectedMissionId ? <MissionDetailPanel accessToken={accessToken} key={selectedMissionId} missionId={selectedMissionId} onClose={closeMissionDetail} /> : null}
      {exceptionWorkspaceOpen && hasPermission('exception.read') ? <ExceptionWorkspace accessToken={accessToken} initialExceptionId={selectedExceptionId} onClose={() => setExceptionWorkspaceOpen(false)} /> : null}
    </main>
  );
}
