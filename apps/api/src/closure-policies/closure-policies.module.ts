import { Module } from '@nestjs/common';
import { ClosurePoliciesController } from './closure-policies.controller';
import { ClosurePoliciesService } from './closure-policies.service';
import { ClosureRequirementsService } from './closure-requirements.service';

@Module({
  controllers: [ClosurePoliciesController],
  providers: [ClosurePoliciesService, ClosureRequirementsService],
  exports: [ClosureRequirementsService],
})
export class ClosurePoliciesModule {}
