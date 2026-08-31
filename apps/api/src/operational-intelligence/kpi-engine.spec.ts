import { calculateMissionKpi } from './kpi-engine';

const mission = {
  missionId: 'mission-1',
  clientId: 'client-1',
  carrierId: 'carrier-1',
  driverId: 'driver-1',
  status: 'DELIVERED',
  scheduledLoadingAt: '2026-08-13T08:00:00Z',
  actualLoadingAt: '2026-08-13T08:10:00Z',
  scheduledDepartureAt: '2026-08-13T09:00:00Z',
  actualDepartureAt: '2026-08-13T09:20:00Z',
  stops: [
    {
      id: 'stop-1',
      expectedArrival: '2026-08-13T10:00:00Z',
      actualArrival: '2026-08-13T10:10:00Z',
      status: 'COMPLETED',
    },
  ],
  documents: [{ type: 'POD', verificationStatus: 'VERIFIED', stopId: 'stop-1' }],
  exceptions: [],
  events: [
    { eventType: 'VEHICLE_ARRIVED', occurredAt: '2026-08-13T07:55:00Z' },
    { eventType: 'DEPARTED', occurredAt: '2026-08-13T09:20:00Z' },
  ],
  externalDataAvailability: {
    gps: { available: false, source: null },
    temperature: { available: false, source: null },
    accident: { available: false, source: null },
  },
  temperatureMonitoringRequired: false,
};

describe('KPI engine', () => {
  it('normalizes the score across available applicable internal components', () => {
    const result = calculateMissionKpi(mission);
    expect(result.score).toBe(100);
    expect(result.applicableWeight).toBe(80);
    expect(result.components.find((item) => item.code === 'TEMPERATURE')).toMatchObject({
      applicable: false,
      score: null,
    });
    expect(result.components.find((item) => item.code === 'ROUTE_COMPLIANCE')).toMatchObject({
      applicable: true,
      available: false,
      score: null,
    });
  });

  it('does not score missing external temperature data as zero', () => {
    const result = calculateMissionKpi({ ...mission, temperatureMonitoringRequired: true });
    const temperature = result.components.find((item) => item.code === 'TEMPERATURE');
    expect(temperature).toMatchObject({ applicable: true, available: false, score: null });
    expect(result.score).toBe(100);
  });
});
