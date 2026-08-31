import type { ControlTowerResponse, MissionStatus } from '../types';

export function TodayFlow({ data, arabic }: { data?: ControlTowerResponse; arabic: boolean }) {
  const count = (statuses: MissionStatus[]) => statuses.reduce((total, status) => total + (data?.summary.byStatus[status] ?? 0), 0);
  const stages = [
    [arabic ? 'مجدولة' : 'Scheduled', count(['DRAFT', 'ASSIGNED', 'WAITING_FOR_VEHICLE'])],
    [arabic ? 'تحميل' : 'Loading', count(['VEHICLE_ARRIVED', 'LOADING', 'LOADED'])],
    [arabic ? 'قيد النقل' : 'In transit', count(['DEPARTED', 'IN_TRANSIT'])],
    [arabic ? 'وصلت' : 'Arrived', count(['AT_STOP', 'DELIVERING'])],
    [arabic ? 'تم التسليم' : 'Delivered', count(['DELIVERED'])],
  ] as const;
  return (
    <section className="today-flow" aria-labelledby="today-flow-title">
      <div><p className="eyebrow">{arabic ? 'التدفق التشغيلي الحالي' : 'CURRENT OPERATIONAL FLOW'}</p><h2 id="today-flow-title">{arabic ? 'تدفق اليوم' : "Today's flow"}</h2></div>
      <ol>{stages.map(([label, value], index) => <li key={label}><span>{index + 1}</span><div><strong>{value}</strong><small>{label}</small></div></li>)}</ol>
      <p>{arabic ? 'تعكس الأعداد حالات المهام الحالية، وليست سجلًا تاريخيًا.' : 'Counts reflect current mission states, not a historical replay.'}</p>
    </section>
  );
}
