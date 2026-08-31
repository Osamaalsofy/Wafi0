import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [ConfigModule, DatabaseModule, JobsModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
