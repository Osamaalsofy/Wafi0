import type { ControlTowerMission } from '../types';
import { translateVisibleText } from '../../../i18n/localized-surface';

function age(value: string, arabic: boolean) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 60) return arabic ? `منذ ${minutes} د` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return arabic ? `منذ ${hours} س` : `${hours}h ago`;
}

export function AttentionPanel({ missions, arabic, onOpenException }: { missions: ControlTowerMission[]; arabic: boolean; onOpenException: (id: string) => void }) {
  const locale = arabic ? 'ar-SA' : 'en';
  const items = missions
    .flatMap((mission) => mission.openExceptions.map((exception) => ({ mission, exception })))
    .sort((left, right) => {
      const rank = { CRITICAL: 4, HIGH: 3, WARNING: 2, INFO: 1 } as const;
      return (rank[right.exception.severity ?? 'INFO'] ?? 0) - (rank[left.exception.severity ?? 'INFO'] ?? 0);
    })
    .slice(0, 8);
  return (
    <aside className="attention-panel" aria-labelledby="attention-title">
      <div className="attention-heading"><div><p>{arabic ? 'مركز التنبيه' : 'EXCEPTION DESK'}</p><h2 id="attention-title">{arabic ? 'يتطلب الانتباه' : 'Attention required'}</h2></div><span>{items.length}</span></div>
      <div className="attention-list">
        {items.length ? items.map(({ mission, exception }) => (
          <button key={exception.id} className="attention-item" onClick={() => onOpenException(exception.id)}>
            <span className={`severity-rail severity-${(exception.severity ?? 'INFO').toLowerCase()}`} />
            <span className="attention-copy">
              <span><strong>{mission.missionNo}</strong><b>{translateVisibleText(exception.severity ?? (arabic ? 'غير محدد' : 'Unset'), locale)}</b></span>
              <em>{translateVisibleText(exception.definition.name, locale)}</em>
              <small>{exception.stop?.branch.name ?? mission.route?.cityRegion ?? mission.warehouse.name} · {age(exception.lastDetectedAt, arabic)}</small>
            </span>
          </button>
        )) : <div className="attention-empty"><strong>{arabic ? 'لا توجد استثناءات مفتوحة' : 'No open exceptions'}</strong><span>{arabic ? 'لا توجد حالات حرجة ضمن العرض الحالي.' : 'No critical conditions in the current view.'}</span></div>}
      </div>
    </aside>
  );
}
