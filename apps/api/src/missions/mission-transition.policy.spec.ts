jest.mock('../../generated/prisma/client', () => ({ PrismaClient: class {} }));

import { MISSION_TRANSITIONS } from './mission-transition.policy';

describe('MISSION_TRANSITIONS', () => {
  it('defines the approved forward lifecycle and terminal states', () => {
    expect(MISSION_TRANSITIONS.DRAFT).toContain('ASSIGNED');
    expect(MISSION_TRANSITIONS.IN_TRANSIT).toContain('AT_STOP');
    expect(MISSION_TRANSITIONS.DELIVERING).toEqual(['AT_STOP', 'DELIVERED', 'CANCELLED']);
    expect(MISSION_TRANSITIONS.CLOSED).toEqual([]);
    expect(MISSION_TRANSITIONS.CANCELLED).toEqual([]);
  });

  it('keeps closure stages in the explicit lifecycle', () => {
    expect(MISSION_TRANSITIONS.DELIVERED).toEqual(['OPERATIONALLY_CLOSED']);
    expect(MISSION_TRANSITIONS.OPERATIONALLY_CLOSED).toEqual(['ACCOUNTING_READY']);
  });
});
