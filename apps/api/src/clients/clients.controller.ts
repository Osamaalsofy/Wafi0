import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentPrincipal, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { ListClientsQueryDto } from './dto/list-clients-query.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@ApiTags('clients')
@ApiBearerAuth()
@Controller({ path: 'clients', version: '1' })
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @RequirePermissions('client.read')
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Query() query: ListClientsQueryDto) {
    return this.clientsService.list(principal, query);
  }

  @Get(':id')
  @RequirePermissions('client.read')
  get(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.clientsService.get(principal, id);
  }

  @Post()
  @RequirePermissions('client.create')
  create(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() input: CreateClientDto) {
    return this.clientsService.create(principal, input);
  }

  @Patch(':id')
  @RequirePermissions('client.update')
  update(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateClientDto,
  ) {
    return this.clientsService.update(principal, id, input);
  }

  @Post(':id/archive')
  @RequirePermissions('client.archive')
  archive(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.clientsService.archive(principal, id);
  }
}
