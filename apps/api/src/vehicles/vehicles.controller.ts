import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentPrincipal, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { ListVehiclesQueryDto } from './dto/list-vehicles-query.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehiclesService } from './vehicles.service';

@ApiTags('vehicles')
@ApiBearerAuth()
@Controller({ path: 'vehicles', version: '1' })
export class VehiclesController {
  constructor(private readonly service: VehiclesService) {}
  @Get() @RequirePermissions('vehicle.read') list(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Query() q: ListVehiclesQueryDto,
  ) {
    return this.service.list(p, q);
  }
  @Get(':id') @RequirePermissions('vehicle.read') get(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.get(p, id);
  }
  @Post() @RequirePermissions('vehicle.create') create(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Body() dto: CreateVehicleDto,
  ) {
    return this.service.create(p, dto);
  }
  @Patch(':id') @RequirePermissions('vehicle.update') update(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.service.update(p, id, dto);
  }
  @Post(':id/archive') @RequirePermissions('vehicle.archive') archive(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.archive(p, id);
  }
}
