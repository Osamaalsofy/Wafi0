import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentPrincipal, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { ReportQueryDto } from './dto/report-query.dto';
import { ReportsService, type ReportType } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller({ path: 'reports', version: '1' })
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get(':type')
  @RequirePermissions('daily_loading.read')
  get(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('type') type: ReportType,
    @Query() query: ReportQueryDto,
  ) {
    return this.reports.get(principal, type, query);
  }
}
