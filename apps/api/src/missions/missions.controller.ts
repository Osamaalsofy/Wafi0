import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentPrincipal, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CreateMissionStopDto } from '../mission-stops/dto/create-mission-stop.dto';
import { CreateMissionDto } from './dto/create-mission.dto';
import { AssignMissionDto } from './dto/assign-mission.dto';
import { ListMissionEventsQueryDto } from './dto/list-mission-events-query.dto';
import { ListMissionsQueryDto } from './dto/list-missions-query.dto';
import { UpdateMissionDto } from './dto/update-mission.dto';
import { TransitionMissionDto } from './dto/transition-mission.dto';
import { MissionsService } from './missions.service';

@ApiTags('missions')
@ApiBearerAuth()
@Controller({ path: 'missions', version: '1' })
export class MissionsController {
  constructor(private readonly service: MissionsService) {}

  @Get()
  @RequirePermissions('mission.read')
  list(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: ListMissionsQueryDto,
  ) {
    return this.service.list(principal, query);
  }

  @Get('driver-portal/me')
  @RequirePermissions('driver_portal.read')
  listForCurrentDriver(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: ListMissionsQueryDto,
  ) {
    return this.service.listForCurrentDriver(principal, query);
  }

  @Get(':id')
  @RequirePermissions('mission.read')
  get(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.get(principal, id);
  }

  @Get(':id/available-transitions')
  @RequirePermissions('mission.read')
  availableTransitions(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.availableTransitions(principal, id);
  }

  @Post()
  @RequirePermissions('mission.create')
  create(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() input: CreateMissionDto) {
    return this.service.create(principal, input);
  }

  @Patch(':id')
  @RequirePermissions('mission.update')
  update(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateMissionDto,
  ) {
    return this.service.update(principal, id, input);
  }

  @Post(':id/assign')
  @RequirePermissions('mission.assign')
  assign(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: AssignMissionDto,
  ) {
    return this.service.assign(principal, id, input);
  }

  @Post(':id/transition')
  @RequirePermissions('mission.transition')
  transition(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: TransitionMissionDto,
  ) {
    return this.service.transition(principal, id, input);
  }

  @Post(':id/stops')
  @RequirePermissions('mission_stop.create')
  addStop(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CreateMissionStopDto,
  ) {
    return this.service.addStop(principal, id, input);
  }

  @Get(':id/events')
  @RequirePermissions('mission.read')
  listEvents(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListMissionEventsQueryDto,
  ) {
    return this.service.listEvents(principal, id, query);
  }
}
