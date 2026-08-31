import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentPrincipal, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CreateRuleConfigurationDto } from './dto/create-rule-configuration.dto';
import { ListRuleConfigurationsQueryDto } from './dto/list-rule-configurations-query.dto';
import { RuleConfigurationsService } from './rule-configurations.service';

@ApiTags('rule-configurations')
@ApiBearerAuth()
@Controller({ path: 'rule-configurations', version: '1' })
export class RuleConfigurationsController {
  constructor(private readonly service: RuleConfigurationsService) {}

  @Get()
  @RequirePermissions('rule.read')
  list(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: ListRuleConfigurationsQueryDto,
  ) {
    return this.service.list(principal, query);
  }

  @Get('options')
  @RequirePermissions('rule.read')
  options(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.service.options(principal);
  }

  @Post()
  @RequirePermissions('rule.manage')
  create(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() input: CreateRuleConfigurationDto,
  ) {
    return this.service.create(principal, input);
  }
}
