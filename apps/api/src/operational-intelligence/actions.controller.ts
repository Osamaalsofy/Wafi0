import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentPrincipal, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CompleteActionDto } from './dto/complete-action.dto';
import { CreateActionDto } from './dto/create-action.dto';
import { ExceptionsService } from './exceptions.service';

@ApiTags('decisions-actions')
@ApiBearerAuth()
@Controller({ version: '1' })
export class ActionsController {
  constructor(private readonly service: ExceptionsService) {}

  @Post('decisions/:id/actions')
  @RequirePermissions('action.create')
  create(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CreateActionDto,
  ) {
    return this.service.addAction(principal, id, input);
  }

  @Post('actions/:id/complete')
  @RequirePermissions('action.update')
  complete(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CompleteActionDto,
  ) {
    return this.service.completeAction(principal, id, input);
  }
}
