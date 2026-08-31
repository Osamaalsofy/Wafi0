import { Body, Controller, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentPrincipal, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { MissionsService } from '../missions/missions.service';
import { UpdateMissionStopDto } from './dto/update-mission-stop.dto';
import { CompleteMissionStopDto } from './dto/complete-mission-stop.dto';
import { RecordStopArrivalDto } from './dto/record-stop-arrival.dto';
import { StartUnloadingDto } from './dto/start-unloading.dto';
import { MissionStopOperationsService } from './mission-stop-operations.service';

@ApiTags('mission-stops')
@ApiBearerAuth()
@Controller({ path: 'mission-stops', version: '1' })
export class MissionStopsController {
  constructor(
    private readonly service: MissionsService,
    private readonly operations: MissionStopOperationsService,
  ) {}

  @Patch(':id')
  @RequirePermissions('mission_stop.update')
  update(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateMissionStopDto,
  ) {
    return this.service.updateStop(principal, id, input);
  }

  @Post(':id/arrive')
  @RequirePermissions('mission_stop.arrive')
  arrive(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: RecordStopArrivalDto,
  ) {
    return this.operations.arrive(principal, id, input);
  }

  @Post(':id/start-unloading')
  @RequirePermissions('mission_stop.unload')
  startUnloading(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: StartUnloadingDto,
  ) {
    return this.operations.startUnloading(principal, id, input);
  }

  @Post(':id/complete')
  @RequirePermissions('mission_stop.complete')
  complete(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CompleteMissionStopDto,
  ) {
    return this.operations.complete(principal, id, input);
  }
}
