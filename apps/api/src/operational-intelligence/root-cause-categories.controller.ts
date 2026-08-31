import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentPrincipal, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CreateRootCauseCategoryDto } from './dto/create-root-cause-category.dto';
import { RootCauseCategoriesService } from './root-cause-categories.service';

@ApiTags('root-cause-categories')
@ApiBearerAuth()
@Controller({ path: 'root-cause-categories', version: '1' })
export class RootCauseCategoriesController {
  constructor(private readonly service: RootCauseCategoriesService) {}
  @Get() @RequirePermissions('exception.read') list(@CurrentPrincipal() p: AuthenticatedPrincipal) {
    return this.service.list(p);
  }
  @Post() @RequirePermissions('root_cause.manage') create(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Body() input: CreateRootCauseCategoryDto,
  ) {
    return this.service.create(p, input);
  }
  @Post(':id/retire') @RequirePermissions('root_cause.manage') retire(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.retire(p, id);
  }
}
