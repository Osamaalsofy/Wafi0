import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentPrincipal, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { ExceptionsService } from './exceptions.service';
import { ListAlertsQueryDto } from './dto/list-alerts-query.dto';
import { AlertOperationsService } from './alert-operations.service';
import { RecordAlertDeliveryAttemptDto } from './dto/record-alert-delivery-attempt.dto';
import { EscalateDueAlertsDto } from './dto/escalate-due-alerts.dto';

@ApiTags('alerts')
@ApiBearerAuth()
@Controller({ path: 'alerts', version: '1' })
export class AlertsController {
  constructor(
    private readonly service: ExceptionsService,
    private readonly operations: AlertOperationsService,
  ) {}

  @Get()
  @RequirePermissions('alert.read')
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Query() query: ListAlertsQueryDto) {
    return this.service.listAlerts(principal, query);
  }

  @Post(':id/read')
  @RequirePermissions('alert.update')
  markRead(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.markAlertRead(principal, id);
  }

  @Post(':id/delivery-attempts/:attemptNo')
  @RequirePermissions('alert.deliver')
  recordDeliveryAttempt(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attemptNo', ParseIntPipe) attemptNo: number,
    @Body() input: RecordAlertDeliveryAttemptDto,
  ) {
    return this.operations.recordDeliveryAttempt(principal, id, attemptNo, input);
  }

  @Post('escalate-due')
  @RequirePermissions('alert.escalate')
  escalateDue(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() input: EscalateDueAlertsDto,
  ) {
    return this.operations.escalateDue(principal, input);
  }
}
