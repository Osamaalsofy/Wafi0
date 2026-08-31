import { bootstrapAdministratorPermissions } from '../scripts/bootstrap-permissions';

describe('bootstrap administrator permissions', () => {
  it('includes every permission required by newly bootstrapped operational modules', () => {
    expect(bootstrapAdministratorPermissions).toEqual(
      expect.arrayContaining([
        'contract.read',
        'contract.manage',
        'route.read',
        'route.manage',
        'alert.deliver',
        'alert.escalate',
        'kpi.snapshot',
      ]),
    );
    expect(new Set(bootstrapAdministratorPermissions).size).toBe(
      bootstrapAdministratorPermissions.length,
    );
  });
});
