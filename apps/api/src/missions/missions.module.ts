import { Module } from '@nestjs/common';
import { MissionStopsController } from '../mission-stops/mission-stops.controller';
import { ClosurePoliciesModule } from '../closure-policies/closure-policies.module';
import { MissionStopOperationsService } from '../mission-stops/mission-stop-operations.service';
import { MissionsController } from './missions.controller';
import { MissionsService } from './missions.service';
import { OperationalIntelligenceModule } from '../operational-intelligence/operational-intelligence.module';

@Module({
  imports: [ClosurePoliciesModule, OperationalIntelligenceModule],
  controllers: [MissionsController, MissionStopsController],
  providers: [MissionsService, MissionStopOperationsService],
})
export class MissionsModule {}
