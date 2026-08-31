import type { PrismaClient } from '../../generated/prisma/client';
import { governorateCode, SAUDI_COUNTRY, SAUDI_GOVERNORATES, SAUDI_REGIONS } from './saudi-geography.data';

const SAUDI_BOUNDS = { minLatitude: 16, maxLatitude: 33, minLongitude: 34, maxLongitude: 56 } as const;

export function validateSaudiGeographyData(): void {
  if (Number(SAUDI_REGIONS.length) !== 13) throw new Error(`Expected 13 Saudi regions, received ${Number(SAUDI_REGIONS.length)}`);
  if (Number(SAUDI_GOVERNORATES.length) !== 100) throw new Error(`Expected 100 Saudi governorates, received ${Number(SAUDI_GOVERNORATES.length)}`);
  const regionCodes = new Set<string>(SAUDI_REGIONS.map(([code]) => code));
  const codes = new Set<string>();
  for (const [regionCode, slug, nameAr, nameEn, latitude, longitude] of SAUDI_GOVERNORATES) {
    const code = governorateCode(regionCode, slug);
    if (!regionCodes.has(regionCode)) throw new Error(`Orphan governorate ${code}: unknown region ${regionCode}`);
    if (codes.has(code)) throw new Error(`Duplicate governorate code ${code}`);
    codes.add(code);
    if (!nameAr.trim() || !nameEn.trim()) throw new Error(`Missing bilingual name for ${code}`);
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) throw new Error(`Invalid coordinates for ${code}`);
    if (latitude < SAUDI_BOUNDS.minLatitude || latitude > SAUDI_BOUNDS.maxLatitude || longitude < SAUDI_BOUNDS.minLongitude || longitude > SAUDI_BOUNDS.maxLongitude)
      throw new Error(`Coordinates outside reasonable Saudi bounds for ${code}`);
  }
}

export async function seedSaudiGeography(prisma: PrismaClient): Promise<void> {
  validateSaudiGeographyData();
  await prisma.$transaction(async (tx) => {
    const country = await tx.country.upsert({
      where: { code: SAUDI_COUNTRY.code },
      create: SAUDI_COUNTRY,
      update: { nameAr: SAUDI_COUNTRY.nameAr, nameEn: SAUDI_COUNTRY.nameEn, isActive: true },
    });
    const regions = new Map<string, string>();
    for (const [code, nameAr, nameEn, latitude, longitude] of SAUDI_REGIONS) {
      const region = await tx.geographicRegion.upsert({
        where: { code },
        create: { countryId: country.id, code, nameAr, nameEn, latitude, longitude },
        update: { countryId: country.id, nameAr, nameEn, latitude, longitude, isActive: true },
      });
      regions.set(code, region.id);
    }
    for (const [regionCode, slug, nameAr, nameEn, latitude, longitude, isMajor = false] of SAUDI_GOVERNORATES) {
      const code = governorateCode(regionCode, slug);
      const regionId = regions.get(regionCode);
      if (!regionId) throw new Error(`Region ${regionCode} was not seeded`);
      await tx.governorate.upsert({
        where: { code },
        create: { regionId, code, nameAr, nameEn, latitude, longitude, coordinateSource: 'GASTAT_ADMIN_GEONAMES_CENTER', isMajor },
        update: { regionId, nameAr, nameEn, latitude, longitude, coordinateSource: 'GASTAT_ADMIN_GEONAMES_CENTER', isMajor, isActive: true },
      });
    }
  });
}
