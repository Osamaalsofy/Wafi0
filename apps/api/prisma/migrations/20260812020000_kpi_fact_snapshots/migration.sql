CREATE TABLE "kpi_fact_snapshots" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "configuration_id" UUID NOT NULL,
  "idempotency_key" UUID NOT NULL,
  "period_date" DATE NOT NULL,
  "time_zone" VARCHAR(80) NOT NULL,
  "source_cutoff_at" TIMESTAMPTZ(6) NOT NULL,
  "mission_set_hash" CHAR(64) NOT NULL,
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "kpi_fact_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "kpi_mission_facts" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "snapshot_id" UUID NOT NULL,
  "mission_id" UUID NOT NULL,
  "client_id" UUID NOT NULL,
  "contract_id" UUID,
  "route_id" UUID,
  "warehouse_id" UUID NOT NULL,
  "carrier_id" UUID,
  "driver_id" UUID,
  "mission_state" JSONB NOT NULL,
  "exception_facts" JSONB NOT NULL,
  "external_data_availability" JSONB NOT NULL,
  "captured_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "kpi_mission_facts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "kpi_fact_snapshots_organization_id_idempotency_key_key" ON "kpi_fact_snapshots"("organization_id", "idempotency_key");
CREATE INDEX "kpi_fact_snapshots_organization_id_period_date_idx" ON "kpi_fact_snapshots"("organization_id", "period_date");
CREATE INDEX "kpi_fact_snapshots_configuration_id_period_date_idx" ON "kpi_fact_snapshots"("configuration_id", "period_date");
CREATE UNIQUE INDEX "kpi_mission_facts_snapshot_id_mission_id_key" ON "kpi_mission_facts"("snapshot_id", "mission_id");
CREATE INDEX "kpi_mission_facts_organization_id_client_id_captured_at_idx" ON "kpi_mission_facts"("organization_id", "client_id", "captured_at");
CREATE INDEX "kpi_mission_facts_organization_id_driver_id_captured_at_idx" ON "kpi_mission_facts"("organization_id", "driver_id", "captured_at");

ALTER TABLE "kpi_fact_snapshots" ADD CONSTRAINT "kpi_fact_snapshots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "kpi_fact_snapshots" ADD CONSTRAINT "kpi_fact_snapshots_configuration_id_fkey" FOREIGN KEY ("configuration_id") REFERENCES "kpi_configurations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "kpi_fact_snapshots" ADD CONSTRAINT "kpi_fact_snapshots_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "kpi_mission_facts" ADD CONSTRAINT "kpi_mission_facts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "kpi_mission_facts" ADD CONSTRAINT "kpi_mission_facts_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "kpi_fact_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "kpi_mission_facts" ADD CONSTRAINT "kpi_mission_facts_mission_id_organization_id_fkey" FOREIGN KEY ("mission_id", "organization_id") REFERENCES "missions"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "code", "description") VALUES
  (gen_random_uuid(), 'kpi.snapshot', 'Create immutable mission-level KPI fact snapshots')
ON CONFLICT ("code") DO NOTHING;
