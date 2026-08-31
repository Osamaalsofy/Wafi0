jest.mock('../../generated/prisma/client', () => ({ PrismaClient: class {} }));

import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service';
import { GeographyService } from './geography.service';

describe('GeographyService', () => {
  it.each(['الرياض', 'Riyadh'])('searches Arabic and English names for %s', async (search) => {
    let where: unknown;
    const prisma = {
      governorate: {
        findMany: jest.fn((input: { where: unknown }) => { where = input.where; return 'data'; }),
        count: jest.fn().mockReturnValue('count'),
      },
      $transaction: jest.fn().mockResolvedValue([[], 0]),
    } as unknown as PrismaService;
    await new GeographyService(prisma).listGovernorates({ page: 1, limit: 50, search });
    expect(JSON.stringify(where)).toContain(`"nameAr":{"contains":"${search}"`);
    expect(JSON.stringify(where)).toContain(`"nameEn":{"contains":"${search}"`);
  });

  it('filters governorates by region', async () => {
    let where: { regionId?: string } | undefined;
    const prisma = {
      governorate: { findMany: jest.fn((input: { where: typeof where }) => { where = input.where; return 'data'; }), count: jest.fn().mockReturnValue('count') },
      $transaction: jest.fn().mockResolvedValue([[], 0]),
    } as unknown as PrismaService;
    await new GeographyService(prisma).listGovernorates({ page: 1, limit: 50 }, 'region-id');
    expect(where?.regionId).toBe('region-id');
  });

  it('rejects an unknown governorate', async () => {
    const prisma = { governorate: { findFirst: jest.fn().mockResolvedValue(null) } } as unknown as PrismaService;
    await expect(new GeographyService(prisma).getGovernorate('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
