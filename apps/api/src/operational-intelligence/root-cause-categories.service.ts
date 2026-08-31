import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import type { CreateRootCauseCategoryDto } from './dto/create-root-cause-category.dto';

@Injectable()
export class RootCauseCategoriesService {
  constructor(private readonly prisma: PrismaService) {}
  list(principal: AuthenticatedPrincipal) {
    return this.prisma.rootCauseCategory.findMany({
      where: { organizationId: principal.organizationId },
      orderBy: [{ isActive: 'desc' }, { code: 'asc' }],
    });
  }
  async create(principal: AuthenticatedPrincipal, input: CreateRootCauseCategoryDto) {
    if (
      input.parentId &&
      !(await this.prisma.rootCauseCategory.findFirst({
        where: { id: input.parentId, organizationId: principal.organizationId, isActive: true },
      }))
    )
      throw new NotFoundException('Active parent root cause category not found');
    try {
      return await this.prisma.rootCauseCategory.create({
        data: {
          organizationId: principal.organizationId,
          code: input.code,
          nameEn: input.nameEn.trim(),
          nameAr: input.nameAr.trim(),
          parentId: input.parentId,
        },
      });
    } catch {
      throw new ConflictException('Root cause category code already exists');
    }
  }
  async retire(principal: AuthenticatedPrincipal, id: string) {
    const category = await this.prisma.rootCauseCategory.findFirst({
      where: { id, organizationId: principal.organizationId },
    });
    if (!category) throw new NotFoundException('Root cause category not found');
    if (!category.isActive) return category;
    return this.prisma.rootCauseCategory.update({
      where: { id },
      data: { isActive: false, retiredAt: new Date() },
    });
  }
}
