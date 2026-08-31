import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentPrincipal, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { AssignExceptionDto } from './dto/assign-exception.dto';
import { AttachEvidenceDto } from './dto/attach-evidence.dto';
import { ChangeExceptionSeverityDto } from './dto/change-exception-severity.dto';
import { CreateDecisionDto } from './dto/create-decision.dto';
import { CreateRootCauseDto } from './dto/create-root-cause.dto';
import { ListExceptionsQueryDto } from './dto/list-exceptions-query.dto';
import { ResolveExceptionDto } from './dto/resolve-exception.dto';
import { ExceptionsService } from './exceptions.service';

@ApiTags('exceptions')
@ApiBearerAuth()
@Controller({ path: 'exceptions', version: '1' })
export class ExceptionsController {
  constructor(private readonly service: ExceptionsService) {}

  @Get()
  @RequirePermissions('exception.read')
  list(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: ListExceptionsQueryDto,
  ) {
    return this.service.list(principal, query);
  }

  @Get(':id')
  @RequirePermissions('exception.read')
  get(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.get(principal, id);
  }

  @Post(':id/assign')
  @RequirePermissions('exception.manage')
  assign(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: AssignExceptionDto,
  ) {
    return this.service.assign(principal, id, input);
  }

  @Post(':id/severity')
  @RequirePermissions('exception.manage')
  severity(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ChangeExceptionSeverityDto,
  ) {
    return this.service.changeSeverity(principal, id, input);
  }

  @Post(':id/resolve')
  @RequirePermissions('exception.manage')
  resolve(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ResolveExceptionDto,
  ) {
    return this.service.resolve(principal, id, input);
  }

  @Post(':id/root-causes')
  @RequirePermissions('root_cause.create')
  rootCause(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CreateRootCauseDto,
  ) {
    return this.service.addRootCause(principal, id, input);
  }

  @Post(':id/decisions')
  @RequirePermissions('decision.create')
  decision(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CreateDecisionDto,
  ) {
    return this.service.addDecision(principal, id, input);
  }

  @Post(':id/evidence')
  @RequirePermissions('exception.manage')
  evidence(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: AttachEvidenceDto,
  ) {
    return this.service.attachEvidence(principal, id, input);
  }
}
