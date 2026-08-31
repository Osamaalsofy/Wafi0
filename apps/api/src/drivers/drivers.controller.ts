import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentPrincipal, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { DriversService } from './drivers.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { ListDriversQueryDto } from './dto/list-drivers-query.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';

@ApiTags('drivers')
@ApiBearerAuth()
@Controller({ path: 'drivers', version: '1' })
export class DriversController {
  constructor(private readonly service: DriversService) {}
  @Get() @RequirePermissions('driver.read') list(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Query() q: ListDriversQueryDto,
  ) {
    return this.service.list(p, q);
  }
  @Get(':id') @RequirePermissions('driver.read') get(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.get(p, id);
  }
  @Post() @RequirePermissions('driver.create') create(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Body() dto: CreateDriverDto,
  ) {
    return this.service.create(p, dto);
  }
  @Patch(':id') @RequirePermissions('driver.update') update(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDriverDto,
  ) {
    return this.service.update(p, id, dto);
  }
  @Post(':id/archive') @RequirePermissions('driver.archive') archive(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.archive(p, id);
  }
}
