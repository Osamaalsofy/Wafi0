import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentPrincipal, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CalculateKpiDto } from './dto/calculate-kpi.dto';
import { KpiResultsService } from './kpi-results.service';

@ApiTags('kpi-results')
@ApiBearerAuth()
@Controller({ path: 'kpi-results', version: '1' })
export class KpiResultsController {
  constructor(private readonly service: KpiResultsService) {}
  @Get() @RequirePermissions('kpi.read') list(@CurrentPrincipal() p: AuthenticatedPrincipal) {
    return this.service.list(p);
  }
  @Get(':id') @RequirePermissions('kpi.read') get(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.get(p, id);
  }
  @Post('calculate') @RequirePermissions('kpi.calculate') calculate(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Body() input: CalculateKpiDto,
  ) {
    return this.service.calculate(p, input);
  }
  @Post(':id/publish') @RequirePermissions('kpi.publish') publish(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.publish(p, id);
  }
}
