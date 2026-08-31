import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentPrincipal, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { ClosurePoliciesService } from './closure-policies.service';
import { ListClosurePoliciesQueryDto } from './dto/list-closure-policies-query.dto';
import { SaveClosurePolicyDto } from './dto/save-closure-policy.dto';

@ApiTags('closure-policies')
@ApiBearerAuth()
@Controller({ path: 'closure-policies', version: '1' })
export class ClosurePoliciesController {
  constructor(private readonly service: ClosurePoliciesService) {}
  @Get() @RequirePermissions('closure_policy.read') list(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Query() q: ListClosurePoliciesQueryDto,
  ) {
    return this.service.list(p, q);
  }
  @Put() @RequirePermissions('closure_policy.manage') save(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Body() dto: SaveClosurePolicyDto,
  ) {
    return this.service.save(p, dto);
  }
  @Post(':id/activate') @RequirePermissions('closure_policy.manage') activate(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.activate(p, id);
  }
  @Post(':id/approve') @RequirePermissions('closure_policy.manage') approve(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.approve(p, id);
  }
  @Post(':id/deactivate') @RequirePermissions('closure_policy.manage') deactivate(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.deactivate(p, id);
  }
}
