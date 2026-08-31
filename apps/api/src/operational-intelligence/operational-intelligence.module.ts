import { Module } from '@nestjs/common';
import { ActionsController } from './actions.controller';
import { AlertsController } from './alerts.controller';
import { ExceptionsController } from './exceptions.controller';
import { ExceptionsService } from './exceptions.service';
import { RuleConfigurationsController } from './rule-configurations.controller';
import { RuleConfigurationsService } from './rule-configurations.service';
import { RuleEvaluatorService } from './rule-evaluator.service';
import { KpiConfigurationsController } from './kpi-configurations.controller';
import { KpiConfigurationsService } from './kpi-configurations.service';
import { RuleReevaluationController } from './rule-reevaluation.controller';
import { RuleReevaluationService } from './rule-reevaluation.service';
import { ReevaluationThrottleGuard } from './reevaluation-throttle.guard';
import { RouteDeviationsController } from './route-deviations.controller';
import { RouteDeviationsService } from './route-deviations.service';
import { AlertOperationsService } from './alert-operations.service';
import { KpiFactSnapshotsController } from './kpi-fact-snapshots.controller';
import { KpiFactSnapshotsService } from './kpi-fact-snapshots.service';
import { KpiResultsController } from './kpi-results.controller';
import { KpiResultsService } from './kpi-results.service';
import { RootCauseCategoriesController } from './root-cause-categories.controller';
import { RootCauseCategoriesService } from './root-cause-categories.service';

@Module({
  controllers: [
    RuleConfigurationsController,
    ExceptionsController,
    ActionsController,
    AlertsController,
    KpiConfigurationsController,
    RuleReevaluationController,
    RouteDeviationsController,
    KpiFactSnapshotsController,
    KpiResultsController,
    RootCauseCategoriesController,
  ],
  providers: [
    RuleConfigurationsService,
    RuleEvaluatorService,
    ExceptionsService,
    KpiConfigurationsService,
    RuleReevaluationService,
    ReevaluationThrottleGuard,
    RouteDeviationsService,
    AlertOperationsService,
    KpiFactSnapshotsService,
    KpiResultsService,
    RootCauseCategoriesService,
  ],
  exports: [
    RuleEvaluatorService,
    RuleReevaluationService,
    AlertOperationsService,
    KpiResultsService,
  ],
})
export class OperationalIntelligenceModule {}
