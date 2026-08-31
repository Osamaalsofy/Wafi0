import { NotFoundException } from '@nestjs/common';
jest.mock('../../generated/prisma/client', () => ({ PrismaClient: class {} }));
import { WaybillsService } from './waybills.service';

const principal = { userId: 'user-1', organizationId: 'org-1', email: 'ops@example.com', grants: [{ permission: 'document.read', scopeType: 'ORGANIZATION' as const, scopeId: 'org-1' }] };
const mission = { id: 'mission-1', organizationId: 'org-1', missionNo: 'M-100', clientId: 'client-1', createdAt: new Date('2026-08-23T08:00:00Z'), cargoType: 'Food', notes: 'Handle carefully', actualLoadingAt: new Date('2026-08-23T09:00:00Z'), actualDepartureAt: new Date('2026-08-23T09:30:00Z'), client: { name: 'Client A' }, warehouse: { name: 'Riyadh DC', address: 'Riyadh' }, carrier: { name: 'WAFI Carrier' }, vehicle: { plateNo: 'ABC-1234', vehicleType: 'Truck' }, driver: { userId: 'driver-user', name: 'Ahmed', nationalId: '1234567890', phone: '0500000000' }, route: { name: 'Riyadh-Jeddah', cityRegion: 'Jeddah' }, stops: [{ actualArrival: new Date('2026-08-23T15:00:00Z'), unloadingCompletedAt: new Date('2026-08-23T16:00:00Z'), branch: { name: 'Jeddah Branch', address: 'Jeddah' } }] };

describe('WaybillsService', () => {
  it('maps canonical mission, driver, vehicle and route fields into a draft', async () => {
    const prisma = { mission: { findFirst: jest.fn().mockResolvedValue(mission) }, missionEvent: { findFirst: jest.fn().mockResolvedValue(null) } };
    const result = await new WaybillsService(prisma as never).get(principal, mission.id) as Record<string, unknown>;
    expect(result).toMatchObject({ status: 'DRAFT', waybillNumber: 'WB-M-100', client: 'Client A', source: 'Riyadh DC', consignee: 'Jeddah Branch', driverName: 'Ahmed', driverNationalId: '1234567890', vehicleNumber: 'ABC-1234', typeOfGoods: 'Food' });
  });

  it('returns the immutable issued event snapshot instead of changed master data', async () => {
    const snapshot = { status: 'ISSUED', waybillNumber: 'WB-M-100', driverPhone: '0500000000' };
    const prisma = { mission: { findFirst: jest.fn().mockResolvedValue({ ...mission, driver: { ...mission.driver, phone: '0599999999' } }) }, missionEvent: { findFirst: jest.fn().mockResolvedValue({ payload: snapshot }) } };
    await expect(new WaybillsService(prisma as never).get(principal, mission.id)).resolves.toEqual(snapshot);
  });

  it('does not return another client or driver mission', async () => {
    const prisma = { mission: { findFirst: jest.fn().mockResolvedValue(null) } };
    await expect(new WaybillsService(prisma as never).get(principal, mission.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns a privacy-safe public verification projection', async () => {
    const issued = {
      missionId: mission.id,
      occurredAt: new Date('2026-08-23T08:00:00Z'),
      payload: {
        status: 'ISSUED', waybillNumber: 'WB-M-100', issuedAt: '2026-08-23T08:00:00Z',
        client: 'Client A', source: 'Riyadh DC', consignee: 'Jeddah Branch', driverName: 'Ahmed',
        driverNationalId: '1234567890', driverPhone: '0500000000', vehicleNumber: 'ABC-1234',
        carrier: 'WAFI Carrier', typeOfGoods: 'Food', missionNo: 'M-100', notes: 'Internal',
        times: { exit: '2026-08-23T09:30:00Z', arrival: '2026-08-23T15:00:00Z' },
        receipt: { receivedAt: '2026-08-23T16:00:00Z' },
      },
      mission: { status: 'DELIVERED', documents: [{ verificationStatus: 'VERIFIED' }] },
    };
    const prisma = { missionEvent: { findFirst: jest.fn().mockResolvedValueOnce(issued).mockResolvedValueOnce(null) } };
    const result = await new WaybillsService(prisma as never).verify('a'.repeat(43));
    expect(result).toMatchObject({ verificationStatus: 'COMPLETED', waybillNumber: 'WB-M-100', driverName: 'Ahmed', deliveryProofStatus: 'VERIFIED' });
    expect(result).not.toHaveProperty('driverNationalId');
    expect(result).not.toHaveProperty('driverPhone');
    expect(result).not.toHaveProperty('notes');
  });

  it('uses a generic response for malformed verification tokens', async () => {
    await expect(new WaybillsService({} as never).verify('sequential-id')).rejects.toMatchObject({ message: 'Waybill verification unavailable' });
  });
});
