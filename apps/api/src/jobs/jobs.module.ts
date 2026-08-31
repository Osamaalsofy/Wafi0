import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { OperationsProcessor } from './operations.processor';
import { ContractsModule } from '../contracts/contracts.module';
import { OperationalIntelligenceModule } from '../operational-intelligence/operational-intelligence.module';

@Module({
  imports: [ContractsModule, OperationalIntelligenceModule],
  controllers: [JobsController],
  providers: [JobsService, OperationsProcessor],
  exports: [JobsService, OperationsProcessor],
})
export class JobsModule {}
