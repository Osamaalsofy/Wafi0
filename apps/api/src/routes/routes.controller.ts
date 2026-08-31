import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentPrincipal, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CreateRouteDto } from './dto/create-route.dto';
import { ListRoutesQueryDto } from './dto/list-routes-query.dto';
import { RoutesService } from './routes.service';

@ApiTags('routes')
@ApiBearerAuth()
@Controller({ path: 'routes', version: '1' })
export class RoutesController {
  constructor(private readonly routes: RoutesService) {}

  @Get()
  @RequirePermissions('route.read')
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Query() query: ListRoutesQueryDto) {
    return this.routes.list(principal, query);
  }

  @Get(':id')
  @RequirePermissions('route.read')
  get(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.routes.get(principal, id);
  }

  @Post()
  @RequirePermissions('route.manage')
  create(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() input: CreateRouteDto) {
    return this.routes.create(principal, input);
  }
}
