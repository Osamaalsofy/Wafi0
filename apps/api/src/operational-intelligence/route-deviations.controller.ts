import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentPrincipal, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { RecoverRouteDeviationDto } from './dto/recover-route-deviation.dto';
import { StartRouteDeviationDto } from './dto/start-route-deviation.dto';
import { RouteDeviationsService } from './route-deviations.service';

@ApiTags('route-deviations')
@ApiBearerAuth()
@Controller({ path: 'missions/:missionId/route-deviations', version: '1' })
export class RouteDeviationsController {
  constructor(private readonly service: RouteDeviationsService) {}

  @Post()
  @RequirePermissions('exception.manage')
  start(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('missionId', ParseUUIDPipe) missionId: string,
    @Body() input: StartRouteDeviationDto,
  ) {
    return this.service.start(principal, missionId, input);
  }

  @Post(':incidentId/recover')
  @RequirePermissions('exception.manage')
  recover(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('missionId', ParseUUIDPipe) missionId: string,
    @Param('incidentId', ParseUUIDPipe) incidentId: string,
    @Body() input: RecoverRouteDeviationDto,
  ) {
    return this.service.recover(principal, missionId, incidentId, input);
  }
}
