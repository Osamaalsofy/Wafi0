import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentPrincipal, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CreateKpiFactSnapshotDto } from './dto/create-kpi-fact-snapshot.dto';
import { KpiFactSnapshotsService } from './kpi-fact-snapshots.service';

@ApiTags('kpi-fact-snapshots')
@ApiBearerAuth()
@Controller({ path: 'kpi-fact-snapshots', version: '1' })
export class KpiFactSnapshotsController {
  constructor(private readonly service: KpiFactSnapshotsService) {}

  @Get(':id')
  @RequirePermissions('kpi.read')
  get(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.get(principal, id);
  }

  @Post()
  @RequirePermissions('kpi.snapshot')
  create(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() input: CreateKpiFactSnapshotDto,
  ) {
    return this.service.create(principal, input);
  }
}
