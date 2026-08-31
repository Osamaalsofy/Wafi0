import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentPrincipal, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { ControlTowerService } from './control-tower.service';
import { ControlTowerQueryDto } from './dto/control-tower-query.dto';

@ApiTags('control-tower')
@ApiBearerAuth()
@Controller({ path: 'control-tower', version: '1' })
export class ControlTowerController {
  constructor(private readonly service: ControlTowerService) {}

  @Get()
  @RequirePermissions('control_tower.read')
  get(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Query() query: ControlTowerQueryDto) {
    return this.service.get(principal, query);
  }
}
