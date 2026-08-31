import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentPrincipal, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { DailyLoadingService } from './daily-loading.service';
import { DailyLoadingQueryDto } from './dto/daily-loading-query.dto';

@ApiTags('daily-loading')
@ApiBearerAuth()
@Controller({ path: 'daily-loading', version: '1' })
export class DailyLoadingController {
  constructor(private readonly service: DailyLoadingService) {}

  @Get()
  @RequirePermissions('daily_loading.read')
  get(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Query() query: DailyLoadingQueryDto) {
    return this.service.get(principal, query);
  }
}
