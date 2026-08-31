'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { verifyWaybill } from '../../lib/api-client';
import type { PublicWaybillVerification } from './types';

const label: Record<string, string> = {
  VALID: 'Valid / سارية',
  COMPLETED: 'Completed / مكتملة',
  CANCELLED: 'Cancelled / ملغاة',
  SUPERSEDED: 'Superseded / مستبدلة',
};
const show = (value: string | null) => value || 'Not available / غير متوفر';
const timestamp = (value: string | null) => value ? new Intl.DateTimeFormat('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not available / غير متوفر';

export function WaybillVerificationPage({ token }: { token: string }) {
  const [data, setData] = useState<PublicWaybillVerification>();
  const [invalid, setInvalid] = useState(false);
  useEffect(() => { const controller = new AbortController(); void verifyWaybill(token, controller.signal).then(setData).catch(() => setInvalid(true)); return () => controller.abort(); }, [token]);
  return <main className="verification-page">
    <section className="verification-card">
      <header><Image className="verification-logo" src="/media/wafi-arabia-waybill-logo.png" alt="WAFI Arabia" width={300} height={135} priority /><div><strong>WAFI ARABIA</strong><span>Waybill Verification / التحقق من بوليصة الشحن</span></div></header>
      {invalid ? <div className="verification-invalid"><b>Invalid / غير صالحة</b><p>This verification reference is unavailable or invalid.<br/>مرجع التحقق غير صالح أو غير متاح.</p></div> : !data ? <div className="verification-loading">Verifying waybill… / جاري التحقق…</div> : <>
        <div className={`verification-result verification-${data.verificationStatus.toLowerCase()}`}><span>Verification Status / حالة التحقق</span><strong>{label[data.verificationStatus]}</strong></div>
        <dl className="verification-grid">
          <Item label="Waybill Number / رقم البوليصة" value={data.waybillNumber} />
          <Item label="Issue Date / تاريخ الإصدار" value={timestamp(data.issueDate)} />
          <Item label="Client / العميل" value={data.client} />
          <Item label="Source / المصدر" value={data.source} />
          <Item label="Destination / الوجهة" value={data.destination} />
          <Item label="Driver / السائق" value={data.driverName} />
          <Item label="Vehicle / المركبة" value={data.vehicleNumber} />
          <Item label="Carrier / شركة النقل" value={data.carrier} />
          <Item label="Type of Goods / نوع البضاعة" value={data.typeOfGoods} />
          <Item label="Mission Reference / مرجع المهمة" value={data.missionReference} />
          <Item label="Departure / المغادرة" value={timestamp(data.departureTime)} />
          <Item label="Arrival / الوصول" value={timestamp(data.arrivalTime)} />
          <Item label="Delivery / التسليم" value={timestamp(data.deliveryTime)} />
          <Item label="Trip Status / حالة الرحلة" value={data.tripStatus} />
          <Item label="POD Status / حالة إثبات التسليم" value={data.deliveryProofStatus} />
          <Item label="Closure Status / حالة الإغلاق" value={data.closureStatus} />
        </dl>
        <p className="verification-privacy">This public record intentionally excludes National ID, phone numbers, private addresses, notes, exceptions, and attachments.<br/>هذا السجل العام لا يعرض الهوية أو الهاتف أو العناوين الخاصة أو الملاحظات أو المرفقات.</p>
      </>}
    </section>
  </main>;
}

function Item({ label, value }: { label: string; value: string | null }) {
  return <div><dt>{label}</dt><dd>{show(value)}</dd></div>;
}
