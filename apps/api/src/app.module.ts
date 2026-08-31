import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuditModule } from './audit/audit.module';
import { AccessTokenGuard } from './auth/auth.guard';
import { AuthModule } from './auth/auth.module';
import { PermissionsGuard } from './auth/permissions.guard';
import { DatabaseModule } from './database/database.module';
import { DriversModule } from './drivers/drivers.module';
import { ClientsModule } from './clients/clients.module';
import { CarriersModule } from './carriers/carriers.module';
import { BranchesModule } from './branches/branches.module';
import { HealthModule } from './health/health.module';
import { RolesModule } from './roles/roles.module';
import { ReportsModule } from './reports/reports.module';
import { validateEnvironment, type Environment } from './environment';
import { UsersModule } from './users/users.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { MissionsModule } from './missions/missions.module';
import { DailyLoadingModule } from './daily-loading/daily-loading.module';
import { DocumentsModule } from './documents/documents.module';
import { ClosurePoliciesModule } from './closure-policies/closure-policies.module';
import { ControlTowerModule } from './control-tower/control-tower.module';
import { OperationalIntelligenceModule } from './operational-intelligence/operational-intelligence.module';
import { ContractsModule } from './contracts/contracts.module';
import { RoutesModule } from './routes/routes.module';
import { JobsModule } from './jobs/jobs.module';
import { GeographyModule } from './geography/geography.module';
import { SupportModule } from './support/support.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnvironment }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) => [
        {
          ttl: config.get('RATE_LIMIT_TTL_MS', { infer: true }),
          limit: config.get('RATE_LIMIT_MAX', { infer: true }),
        },
      ],
    }),
    DatabaseModule,
    AuthModule,
    AuditModule,
    ClientsModule,
    CarriersModule,
    BranchesModule,
    WarehousesModule,
    DriversModule,
    VehiclesModule,
    MissionsModule,
    DailyLoadingModule,
    DocumentsModule,
    ClosurePoliciesModule,
    ControlTowerModule,
    OperationalIntelligenceModule,
    ContractsModule,
    RoutesModule,
    JobsModule,
    GeographyModule,
    HealthModule,
    UsersModule,
    RolesModule,
    ReportsModule,
    SupportModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AccessTokenGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
