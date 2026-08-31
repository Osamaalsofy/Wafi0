import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WaybillPaper } from './digital-waybill';

describe('digital waybill', () => {
  it('renders bilingual A4 content from canonical values', () => {
    render(<WaybillPaper value={{ status: 'ISSUED', verificationToken: null, waybillNumber: 'WB-M-100', issuedAt: '2026-08-23T08:00:00Z', date: '2026-08-23T08:00:00Z', missionNo: 'M-100', client: 'Client A', source: 'Riyadh DC', sourceAddress: null, consignee: 'Jeddah Branch', destinationAddress: null, route: 'Route', city: 'Jeddah', carrier: 'Carrier', driverName: 'Ahmed', driverNationalId: '1234567890', driverPhone: '0500000000', vehicleNumber: 'ABC-1234', vehicleType: 'Truck', freightValue: null, typeOfGoods: 'Food', notes: null, times: { arrival: null, loaded: null, exit: null, breaks: null }, receipt: { receivedAt: null, receiverName: null }, declaration: { ar: 'النص القانوني', en: 'Legal declaration' }, insuranceNote: { ar: 'الأسعار لا تشمل التأمين', en: 'Rates exclude insurance' } }} />);
    expect(screen.getByRole('heading', { name: 'Waybill Consignment Note' })).toBeVisible();
    expect(screen.getByText('بوليصة شحن')).toBeVisible();
    expect(screen.getByText('1234567890')).toBeVisible();
    expect(screen.getByText('الأسعار لا تشمل التأمين')).toBeVisible();
  });
});
