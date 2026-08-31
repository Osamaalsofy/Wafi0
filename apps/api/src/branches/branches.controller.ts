import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentPrincipal, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { ListBranchesQueryDto } from './dto/list-branches-query.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@ApiTags('branches')
@ApiBearerAuth()
@Controller({ path: 'branches', version: '1' })
export class BranchesController {
  constructor(private readonly service: BranchesService) {}
  @Get() @RequirePermissions('branch.read') list(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Query() q: ListBranchesQueryDto,
  ) {
    return this.service.list(p, q);
  }
  @Get(':id') @RequirePermissions('branch.read') get(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.get(p, id);
  }
  @Post() @RequirePermissions('branch.create') create(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Body() dto: CreateBranchDto,
  ) {
    return this.service.create(p, dto);
  }
  @Patch(':id') @RequirePermissions('branch.update') update(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.service.update(p, id, dto);
  }
  @Post(':id/archive') @RequirePermissions('branch.archive') archive(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.archive(p, id);
  }
}
