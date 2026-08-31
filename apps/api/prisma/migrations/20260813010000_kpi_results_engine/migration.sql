CREATE TYPE "KpiResultStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUPERSEDED');
CREATE TYPE "KpiPeriodType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

ALTER TABLE "operational_contracts"
ADD COLUMN "temperature_monitoring_required" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "minimum_temperature" DECIMAL(7,2),
ADD COLUMN "maximum_temperature" DECIMAL(7,2),
ADD COLUMN "temperature_grace_minutes" INTEGER,
ADD COLUMN "temperature_sensor_reference" VARCHAR(160),
ADD CONSTRAINT "operational_contracts_temperature_range_check" CHECK (
  ("temperature_monitoring_required" = false) OR
  ("minimum_temperature" IS NOT NULL AND "maximum_temperature" IS NOT NULL AND
   "minimum_temperature" <= "maximum_temperature" AND "temperature_grace_minutes" >= 0)
);

CREATE TABLE "kpi_results" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "snapshot_id" UUID NOT NULL,
  "period_type" "KpiPeriodType" NOT NULL,
  "period_start" DATE NOT NULL,
  "period_end" DATE NOT NULL,
  "time_zone" VARCHAR(80) NOT NULL,
  "calculation_version" INTEGER NOT NULL,
  "status" "KpiResultStatus" NOT NULL DEFAULT 'DRAFT',
  "score" DECIMAL(6,2),
  "target_percent" DECIMAL(5,2) NOT NULL DEFAULT 90,
  "eligible_mission_count" INTEGER NOT NULL,
  "component_summary" JSONB NOT NULL,
  "input_hash" CHAR(64) NOT NULL,
  "calculated_at" TIMESTAMPTZ(6) NOT NULL,
  "source_cutoff_at" TIMESTAMPTZ(6) NOT NULL,
  "published_at" TIMESTAMPTZ(6),
  "published_by_user_id" UUID,
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "kpi_results_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "kpi_mission_results" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "result_id" UUID NOT NULL,
  "mission_id" UUID NOT NULL,
  "client_id" UUID NOT NULL,
  "carrier_id" UUID,
  "driver_id" UUID,
  "score" DECIMAL(6,2),
  "applicable_weight" DECIMAL(6,2) NOT NULL,
  "target_met" BOOLEAN,
  "components" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "kpi_mission_results_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "kpi_results_organization_id_snapshot_id_period_type_calculation_version_key"
ON "kpi_results"("organization_id", "snapshot_id", "period_type", "calculation_version");
CREATE INDEX "kpi_results_organization_id_period_type_period_start_period_end_status_idx"
ON "kpi_results"("organization_id", "period_type", "period_start", "period_end", "status");
CREATE INDEX "kpi_results_organization_id_published_at_idx" ON "kpi_results"("organization_id", "published_at");
CREATE UNIQUE INDEX "kpi_mission_results_result_id_mission_id_key" ON "kpi_mission_results"("result_id", "mission_id");
CREATE INDEX "kpi_mission_results_organization_id_client_id_created_at_idx" ON "kpi_mission_results"("organization_id", "client_id", "created_at");
CREATE INDEX "kpi_mission_results_organization_id_carrier_id_created_at_idx" ON "kpi_mission_results"("organization_id", "carrier_id", "created_at");
CREATE INDEX "kpi_mission_results_organization_id_driver_id_created_at_idx" ON "kpi_mission_results"("organization_id", "driver_id", "created_at");

ALTER TABLE "kpi_results" ADD CONSTRAINT "kpi_results_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "kpi_results" ADD CONSTRAINT "kpi_results_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "kpi_fact_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "kpi_results" ADD CONSTRAINT "kpi_results_published_by_user_id_fkey" FOREIGN KEY ("published_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "kpi_results" ADD CONSTRAINT "kpi_results_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "kpi_mission_results" ADD CONSTRAINT "kpi_mission_results_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "kpi_mission_results" ADD CONSTRAINT "kpi_mission_results_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "kpi_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kpi_mission_results" ADD CONSTRAINT "kpi_mission_results_mission_id_organization_id_fkey" FOREIGN KEY ("mission_id", "organization_id") REFERENCES "missions"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE "rule_definitions"
SET "default_threshold_minutes" = 15
WHERE "code" = 'LOADING_DELAY';

INSERT INTO "permissions" ("id", "code", "description") VALUES
  (gen_random_uuid(), 'kpi.calculate', 'Calculate or recalculate auditable KPI results'),
  (gen_random_uuid(), 'kpi.publish', 'Publish immutable KPI results')
ON CONFLICT ("code") DO NOTHING;
