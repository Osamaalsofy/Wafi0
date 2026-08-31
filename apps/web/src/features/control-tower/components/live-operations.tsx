'use client';

import { useMemo, useState } from 'react';
import type { ControlTowerMission } from '../types';
import { translateVisibleText } from '../../../i18n/localized-surface';

type Filter = 'all' | 'exceptions' | 'at-risk' | 'arriving';

export function LiveOperations({ missions, arabic, onSelectMission, onSelectException }: { missions: ControlTowerMission[]; arabic: boolean; onSelectMission: (id: string) => void; onSelectException: (id: string) => void }) {
  const [filter, setFilter] = useState<Filter>('all');
  const visible = useMemo(() => missions.filter((mission) => {
    if (filter === 'exceptions') return mission.openExceptions.length > 0;
    if (filter === 'at-risk') return mission.openExceptions.some(({ severity }) => severity === 'HIGH' || severity === 'CRITICAL');
    if (filter === 'arriving') return mission.status === 'AT_STOP' || mission.status === 'DELIVERING';
    return true;
  }), [filter, missions]);
  const filters: Array<[Filter, string]> = [
    ['all', arabic ? 'الكل' : 'All'],
    ['exceptions', arabic ? 'استثناءات' : 'Exceptions'],
    ['at-risk', arabic ? 'عالية الخطورة' : 'At risk'],
    ['arriving', arabic ? 'في الوصول' : 'Arriving'],
  ];
  return (
    <section className="live-operations" aria-labelledby="live-operations-title">
      <div className="live-operations-heading"><div><p className="eyebrow">{arabic ? 'متابعة مباشرة' : 'LIVE OPERATIONS'}</p><h2 id="live-operations-title">{arabic ? 'المهام التشغيلية' : 'Mission movement'}</h2></div><div className="ops-filter-tabs" role="group" aria-label={arabic ? 'تصفية المهام' : 'Mission filters'}>{filters.map(([id, label]) => <button key={id} className={filter === id ? 'active' : ''} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div></div>
      {visible.length ? <div className="mission-table-wrap"><table className="mission-table command-table"><thead><tr><th>{arabic ? 'المهمة' : 'Mission'}</th><th>{arabic ? 'المنشأ ← الوجهة' : 'Origin → destination'}</th><th>{arabic ? 'المركبة / السائق' : 'Vehicle / driver'}</th><th>{arabic ? 'الحالة' : 'Status'}</th><th>{arabic ? 'الاستثناء' : 'Exception'}</th><th><span className="sr-only">{arabic ? 'الإجراء' : 'Action'}</span></th></tr></thead><tbody>{visible.slice(0, 12).map((mission) => {
        const exception = mission.openExceptions[0];
        const destination = mission.mapStops?.at(-1)?.branch.name ?? mission.route?.cityRegion ?? (arabic ? 'غير محدد' : 'Not specified');
        const locale = arabic ? 'ar-SA' : 'en';
        return <tr key={mission.id}><td><strong>{mission.missionNo}</strong><small>{mission.client.name}</small></td><td><span>{mission.warehouse.name}</span><small>→ {destination}</small></td><td><span>{mission.vehicle?.plateNo ?? (arabic ? 'غير مسند' : 'Unassigned')}</span><small>{mission.driver?.name ?? (arabic ? 'لا يوجد سائق' : 'No driver')}</small></td><td><span className={`status-badge status-${mission.status.toLowerCase()}`}>{translateVisibleText(mission.status.replaceAll('_', ' '), locale)}</span></td><td>{exception ? <button className={`exception-pill severity-${(exception.severity ?? 'INFO').toLowerCase()}`} onClick={() => onSelectException(exception.id)}>{translateVisibleText(exception.severity ?? 'INFO', locale)} · {mission.openExceptions.length}</button> : <span className="normal-state">{arabic ? 'طبيعي' : 'Normal'}</span>}</td><td><button className="mission-view-button" onClick={() => onSelectMission(mission.id)}>{arabic ? 'فتح' : 'Open'}</button></td></tr>;
      })}</tbody></table></div> : <div className="state-panel"><strong>{arabic ? 'لا توجد مهام مطابقة' : 'No matching missions'}</strong></div>}
    </section>
  );
}
