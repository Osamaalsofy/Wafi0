jest.mock('../../generated/prisma/client', () => ({ PrismaClient: class {} }));

import { governorateCode, SAUDI_GOVERNORATES, SAUDI_REGIONS } from './saudi-geography.data';
import { validateSaudiGeographyData } from './geography.seed';

describe('Saudi geographic seed data', () => {
  it('contains exactly 13 regions and 100 governorates', () => {
    expect(SAUDI_REGIONS).toHaveLength(13);
    expect(SAUDI_GOVERNORATES).toHaveLength(100);
    expect(() => validateSaudiGeographyData()).not.toThrow();
  });

  it('has unique stable codes, bilingual names, valid Saudi coordinates, and no orphans', () => {
    const regions = new Set<string>(SAUDI_REGIONS.map(([code]) => code));
    const codes = SAUDI_GOVERNORATES.map(([region, slug]) => governorateCode(region, slug));
    expect(new Set(codes).size).toBe(100);
    for (const [region, , nameAr, nameEn, latitude, longitude] of SAUDI_GOVERNORATES) {
      expect(regions.has(region)).toBe(true);
      expect(nameAr.trim()).not.toBe('');
      expect(nameEn.trim()).not.toBe('');
      expect(latitude).toBeGreaterThanOrEqual(16);
      expect(latitude).toBeLessThanOrEqual(33);
      expect(longitude).toBeGreaterThanOrEqual(34);
      expect(longitude).toBeLessThanOrEqual(56);
    }
  });
});
