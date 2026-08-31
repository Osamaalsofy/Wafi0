import { Module } from '@nestjs/common';
import { DailyLoadingController } from './daily-loading.controller';
import { DailyLoadingService } from './daily-loading.service';
import { OperationalIntelligenceModule } from '../operational-intelligence/operational-intelligence.module';

@Module({
  imports: [OperationalIntelligenceModule],
  controllers: [DailyLoadingController],
  providers: [DailyLoadingService],
})
export class DailyLoadingModule {}
