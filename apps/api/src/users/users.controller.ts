import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentPrincipal, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CreateUserDto } from './dto/create-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { LinkDriverDto } from './dto/link-driver.dto';
import { CreateClientPortalUserDto } from './dto/create-client-portal-user.dto';
import { CreateDriverPortalUserDto } from './dto/create-driver-portal-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions('user.read')
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.usersService.list(principal);
  }

  @Post()
  @RequirePermissions('user.create')
  create(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() input: CreateUserDto) {
    return this.usersService.create(principal, input);
  }

  @Post('client-portal')
  @RequirePermissions('user.create', 'user.role.assign')
  createClientPortalUser(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() input: CreateClientPortalUserDto,
  ) {
    return this.usersService.createClientPortalUser(principal, input);
  }

  @Post('driver-portal')
  @RequirePermissions('user.create', 'user.role.assign', 'user.update')
  createDriverPortalUser(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() input: CreateDriverPortalUserDto,
  ) {
    return this.usersService.createDriverPortalUser(principal, input);
  }

  @Patch(':id/status')
  @RequirePermissions('user.update')
  updateStatus(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateUserStatusDto,
  ) {
    return this.usersService.updateStatus(principal, id, input.status);
  }

  @Post(':id/roles')
  @RequirePermissions('user.role.assign')
  assignRole(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: AssignRoleDto,
  ) {
    return this.usersService.assignOrganizationRole(principal, id, input.roleId);
  }

  @Patch(':id/driver')
  @RequirePermissions('user.update')
  linkDriver(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: LinkDriverDto,
  ) {
    return this.usersService.linkDriver(principal, id, input.driverId ?? null, input.nationalId);
  }

  @Post('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() input: ChangePasswordDto,
  ): Promise<void> {
    await this.usersService.changePassword(principal, input.currentPassword, input.newPassword);
  }
}
