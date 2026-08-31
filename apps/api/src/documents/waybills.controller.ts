import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentPrincipal, Public, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { ShareWaybillDto } from './dto/share-waybill.dto';
import { WaybillsService } from './waybills.service';
@ApiTags('waybills') @ApiBearerAuth() @Controller({ path: 'waybills', version: '1' })
export class WaybillsController {
  constructor(private readonly service: WaybillsService) {}
  @Get('verify/:token') @Public()
  verify(@Param('token') token: string) { return this.service.verify(token); }
  @Get('missions/:missionId') @RequirePermissions('document.read')
  get(@CurrentPrincipal() p: AuthenticatedPrincipal, @Param('missionId', ParseUUIDPipe) id: string) { return this.service.get(p, id); }
  @Post('missions/:missionId/issue') @RequirePermissions('document.upload')
  issue(@CurrentPrincipal() p: AuthenticatedPrincipal, @Param('missionId', ParseUUIDPipe) id: string) { return this.service.issue(p, id); }
  @Post('missions/:missionId/share') @RequirePermissions('document.upload')
  share(@CurrentPrincipal() p: AuthenticatedPrincipal, @Param('missionId', ParseUUIDPipe) id: string, @Body() input: ShareWaybillDto) { return this.service.share(p, id, input); }
}
