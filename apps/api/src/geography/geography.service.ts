import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { ListGovernoratesQueryDto } from './dto/list-governorates-query.dto';

@Injectable()
export class GeographyService {
  constructor(private readonly prisma: PrismaService) {}

  async listRegions() {
    const data = await this.prisma.geographicRegion.findMany({
      where: { country: { code: 'SA' }, isActive: true },
      include: { _count: { select: { governorates: { where: { isActive: true } } } } },
      orderBy: [{ nameEn: 'asc' }, { code: 'asc' }],
    });
    return { data, meta: { page: 1, limit: data.length, total: data.length, totalPages: 1 } };
  }

  async listGovernorates(query: ListGovernoratesQueryDto, forcedRegionId?: string) {
    const search = query.search?.trim();
    const where: Prisma.GovernorateWhereInput = {
      regionId: forcedRegionId ?? query.regionId,
      isActive: true,
      isMajor: query.majorOnly ? true : undefined,
      region: { country: { code: 'SA' } },
      ...(search ? { OR: [
        { code: { contains: search, mode: 'insensitive' } },
        { nameAr: { contains: search, mode: 'insensitive' } },
        { nameEn: { contains: search, mode: 'insensitive' } },
        { region: { OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { nameAr: { contains: search, mode: 'insensitive' } },
          { nameEn: { contains: search, mode: 'insensitive' } },
        ] } },
      ] } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.governorate.findMany({
        where,
        include: { region: { select: { id: true, code: true, nameAr: true, nameEn: true } } },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ isMajor: 'desc' }, { nameEn: 'asc' }, { code: 'asc' }],
      }),
      this.prisma.governorate.count({ where }),
    ]);
    return { data, meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  }

  async getGovernorate(id: string) {
    const governorate = await this.prisma.governorate.findFirst({
      where: { id, isActive: true, region: { country: { code: 'SA' } } },
      include: { region: { include: { country: true } } },
    });
    if (!governorate) throw new NotFoundException('Governorate not found');
    return governorate;
  }
}
