import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentPrincipal, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { ListWarehousesQueryDto } from './dto/list-warehouses-query.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { WarehousesService } from './warehouses.service';

@ApiTags('warehouses')
@ApiBearerAuth()
@Controller({ path: 'warehouses', version: '1' })
export class WarehousesController {
  constructor(private readonly service: WarehousesService) {}
  @Get() @RequirePermissions('warehouse.read') list(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Query() q: ListWarehousesQueryDto,
  ) {
    return this.service.list(p, q);
  }
  @Get(':id') @RequirePermissions('warehouse.read') get(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.get(p, id);
  }
  @Post() @RequirePermissions('warehouse.create') create(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Body() dto: CreateWarehouseDto,
  ) {
    return this.service.create(p, dto);
  }
  @Patch(':id') @RequirePermissions('warehouse.update') update(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWarehouseDto,
  ) {
    return this.service.update(p, id, dto);
  }
  @Post(':id/archive') @RequirePermissions('warehouse.archive') archive(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.archive(p, id);
  }
}
