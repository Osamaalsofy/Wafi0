import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentPrincipal, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CarriersService } from './carriers.service';
import { CreateCarrierDto } from './dto/create-carrier.dto';
import { ListCarriersQueryDto } from './dto/list-carriers-query.dto';
import { UpdateCarrierDto } from './dto/update-carrier.dto';

@ApiTags('carriers')
@ApiBearerAuth()
@Controller({ path: 'carriers', version: '1' })
export class CarriersController {
  constructor(private readonly carriersService: CarriersService) {}

  @Get()
  @RequirePermissions('carrier.read')
  list(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: ListCarriersQueryDto,
  ) {
    return this.carriersService.list(principal, query);
  }

  @Get(':id')
  @RequirePermissions('carrier.read')
  get(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.carriersService.get(principal, id);
  }

  @Post()
  @RequirePermissions('carrier.create')
  create(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() input: CreateCarrierDto) {
    return this.carriersService.create(principal, input);
  }

  @Patch(':id')
  @RequirePermissions('carrier.update')
  update(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateCarrierDto,
  ) {
    return this.carriersService.update(principal, id, input);
  }

  @Post(':id/archive')
  @RequirePermissions('carrier.archive')
  archive(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.carriersService.archive(principal, id);
  }
}
