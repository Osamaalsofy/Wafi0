import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentPrincipal, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { ListContractsQueryDto } from './dto/list-contracts-query.dto';
import { ExpireContractsDto } from './dto/expire-contracts.dto';
import { TransitionContractDto } from './dto/transition-contract.dto';

@ApiTags('contracts')
@ApiBearerAuth()
@Controller({ path: 'contracts', version: '1' })
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Get()
  @RequirePermissions('contract.read')
  list(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: ListContractsQueryDto,
  ) {
    return this.contracts.list(principal, query);
  }

  @Get(':id')
  @RequirePermissions('contract.read')
  get(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.contracts.get(principal, id);
  }

  @Post()
  @RequirePermissions('contract.manage')
  create(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() input: CreateContractDto) {
    return this.contracts.create(principal, input);
  }

  @Post('expire-due')
  @RequirePermissions('contract.manage')
  expireDue(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() input: ExpireContractsDto,
  ) {
    return this.contracts.expireDue(principal, input);
  }

  @Post(':id/deactivate')
  @RequirePermissions('contract.manage')
  deactivate(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.contracts.transition(principal, id, { status: 'SUSPENDED' });
  }

  @Post(':id/transition')
  @RequirePermissions('contract.manage')
  transition(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: TransitionContractDto,
  ) {
    return this.contracts.transition(principal, id, input);
  }
}
