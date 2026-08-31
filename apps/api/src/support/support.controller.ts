import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentPrincipal, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { AddSupportMessageDto } from './dto/add-support-message.dto';
import { AssignSupportTicketDto } from './dto/assign-support-ticket.dto';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { SupportService } from './support.service';
@ApiTags('support') @ApiBearerAuth() @Controller({ path: 'support', version: '1' })
export class SupportController {
  constructor(private readonly service: SupportService) {}
  @Get() @RequirePermissions('support.read') list(@CurrentPrincipal() p: AuthenticatedPrincipal) { return this.service.list(p); }
  @Post() @RequirePermissions('support.create') create(@CurrentPrincipal() p: AuthenticatedPrincipal, @Body() i: CreateSupportTicketDto) { return this.service.create(p, i); }
  @Post(':id/messages') @RequirePermissions('support.reply') message(@CurrentPrincipal() p: AuthenticatedPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() i: AddSupportMessageDto) { return this.service.message(p, id, i); }
  @Post(':id/assign') @RequirePermissions('support.assign') assign(@CurrentPrincipal() p: AuthenticatedPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() i: AssignSupportTicketDto) { return this.service.assign(p, id, i); }
}
