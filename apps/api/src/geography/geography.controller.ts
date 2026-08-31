import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/auth.decorators';
import { ListGovernoratesQueryDto } from './dto/list-governorates-query.dto';
import { GeographyService } from './geography.service';

@ApiTags('geography') @ApiBearerAuth()
@Controller({ path: 'regions', version: '1' })
export class RegionsController {
  constructor(private readonly geography: GeographyService) {}
  @Get() @RequirePermissions('geography.read') list() { return this.geography.listRegions(); }
  @Get(':id/governorates') @RequirePermissions('geography.read') governorates(@Param('id', ParseUUIDPipe) id: string, @Query() query: ListGovernoratesQueryDto) {
    return this.geography.listGovernorates(query, id);
  }
}

@ApiTags('geography') @ApiBearerAuth()
@Controller({ path: 'governorates', version: '1' })
export class GovernoratesController {
  constructor(private readonly geography: GeographyService) {}
  @Get() @RequirePermissions('geography.read') list(@Query() query: ListGovernoratesQueryDto) { return this.geography.listGovernorates(query); }
  @Get(':id') @RequirePermissions('geography.read') get(@Param('id', ParseUUIDPipe) id: string) { return this.geography.getGovernorate(id); }
}
