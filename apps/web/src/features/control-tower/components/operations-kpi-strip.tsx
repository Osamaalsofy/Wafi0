import type { ControlTowerResponse } from '../types';

export function OperationsKpiStrip({ data, arabic }: { data?: ControlTowerResponse; arabic: boolean }) {
  const items = data
    ? [
        [arabic ? 'المهام النشطة' : 'Active missions', data.summary.totalActive, 'active'],
        [arabic ? 'قيد النقل' : 'In transit', data.summary.byStatus.IN_TRANSIT, 'transit'],
        [arabic ? 'بحاجة متابعة' : 'With exceptions', data.summary.openExceptions, 'warning'],
        [arabic ? 'استثناءات حرجة' : 'Critical exceptions', data.summary.criticalExceptions, 'critical'],
        [arabic ? 'تم التسليم' : 'Delivered', data.summary.byStatus.DELIVERED, 'delivered'],
      ] as const
    : [];
  return (
    <section className="ops-kpi-strip" aria-label={arabic ? 'مؤشرات العمليات' : 'Operational KPIs'}>
      {!data
        ? Array.from({ length: 5 }, (_, index) => <div className="ops-kpi skeleton" key={index} />)
        : items.map(([label, value, tone]) => (
            <article className={`ops-kpi ${tone}`} key={label}>
              <span>{label}</span><strong>{value}</strong><small>{arabic ? 'بيانات مباشرة' : 'Live factual count'}</small>
            </article>
          ))}
    </section>
  );
}
