jest.mock('../../generated/prisma/client', () => ({ PrismaClient: class {} }));

import { REQUIRED_PERMISSIONS_KEY } from '../auth/auth.decorators';
import { GovernoratesController, RegionsController } from './geography.controller';

describe('Geography API authorization', () => {
  it('requires geography.read for region and governorate endpoints', () => {
    const metadata = (prototype: object, method: string): unknown => Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, Object.getOwnPropertyDescriptor(prototype, method)?.value as object) as unknown;
    expect(metadata(RegionsController.prototype, 'list')).toEqual(['geography.read']);
    expect(metadata(GovernoratesController.prototype, 'list')).toEqual(['geography.read']);
    expect(metadata(GovernoratesController.prototype, 'get')).toEqual(['geography.read']);
  });
});
