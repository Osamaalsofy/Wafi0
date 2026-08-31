import { Module } from '@nestjs/common';
import { GovernoratesController, RegionsController } from './geography.controller';
import { GeographyService } from './geography.service';

@Module({ controllers: [RegionsController, GovernoratesController], providers: [GeographyService], exports: [GeographyService] })
export class GeographyModule {}
