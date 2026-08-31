import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentPrincipal, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CreateKpiConfigurationDto } from './dto/create-kpi-configuration.dto';
import { KpiConfigurationsService } from './kpi-configurations.service';

@ApiTags('kpi-configurations')
@ApiBearerAuth()
@Controller({ path: 'kpi-configurations', version: '1' })
export class KpiConfigurationsController {
  constructor(private readonly service: KpiConfigurationsService) {}

  @Get()
  @RequirePermissions('kpi.read')
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.service.list(principal);
  }

  @Get('options')
  @RequirePermissions('kpi.read')
  options(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.service.options(principal);
  }

  @Post()
  @RequirePermissions('kpi.manage')
  create(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() input: CreateKpiConfigurationDto,
  ) {
    return this.service.create(principal, input);
  }
}
