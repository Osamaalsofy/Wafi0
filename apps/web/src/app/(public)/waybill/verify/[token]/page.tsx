import { WaybillVerificationPage } from '../../../../../features/waybills/waybill-verification-page';

export const metadata = {
  title: 'Waybill Verification',
  description: 'Verify an issued WAFI Arabia waybill.',
  robots: { index: false, follow: false },
};

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <WaybillVerificationPage token={token} />;
}
