import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentPrincipal, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CreateRoleDto } from './dto/create-role.dto';
import { SetRolePermissionsDto } from './dto/set-role-permissions.dto';
import { RolesService } from './roles.service';

@ApiTags('roles')
@ApiBearerAuth()
@Controller({ path: 'roles', version: '1' })
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions('role.read')
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.rolesService.list(principal);
  }

  @Get('permissions')
  @RequirePermissions('role.read')
  listPermissions() {
    return this.rolesService.listPermissions();
  }

  @Post()
  @RequirePermissions('role.create')
  create(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() input: CreateRoleDto) {
    return this.rolesService.create(principal, input);
  }

  @Patch(':id/permissions')
  @RequirePermissions('role.update')
  setPermissions(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: SetRolePermissionsDto,
  ) {
    return this.rolesService.setPermissions(principal, id, input.permissionCodes);
  }
}
