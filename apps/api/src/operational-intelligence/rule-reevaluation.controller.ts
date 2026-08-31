import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentPrincipal, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { ReevaluateRulesDto } from './dto/reevaluate-rules.dto';
import { RuleReevaluationService } from './rule-reevaluation.service';
import { ReevaluationThrottleGuard } from './reevaluation-throttle.guard';

@ApiTags('rule-evaluations')
@ApiBearerAuth()
@Controller({ path: 'rule-evaluations', version: '1' })
export class RuleReevaluationController {
  constructor(private readonly service: RuleReevaluationService) {}

  @Post('reevaluate')
  @UseGuards(ReevaluationThrottleGuard)
  @RequirePermissions('rule.evaluate')
  reevaluate(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() input: ReevaluateRulesDto,
  ) {
    return this.service.reevaluate(principal, input);
  }
}
