-- CreateEnum
CREATE TYPE "RuleScopeType" AS ENUM ('ORGANIZATION', 'CLIENT', 'WAREHOUSE', 'CARRIER', 'CONTRACT', 'ROUTE');

-- ExtendEnum
ALTER TYPE "DocumentType" ADD VALUE 'RECEIVER_SIGNATURE';
ALTER TYPE "DocumentType" ADD VALUE 'RECEIVER_STAMP';

-- CreateEnum
CREATE TYPE "ExceptionSeverity" AS ENUM ('INFO', 'WARNING', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ExceptionStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('OPEN', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('PENDING', 'SENT', 'READ', 'FAILED');

-- CreateTable
CREATE TABLE "rule_definitions" (
    "code" VARCHAR(120) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL,
    "default_threshold_minutes" INTEGER,
    "default_quantity_tolerance" DECIMAL(14,3),
    "enabled_by_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "rule_definitions_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "rule_configurations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "rule_code" VARCHAR(120) NOT NULL,
    "scope_type" "RuleScopeType" NOT NULL,
    "scope_id" UUID NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "threshold_minutes" INTEGER,
    "quantity_tolerance" DECIMAL(14,3),
    "severity" "ExceptionSeverity",
    "is_blocking" BOOLEAN NOT NULL DEFAULT false,
    "owner_user_id" UUID,
    "owner_scope_type" "ScopeType",
    "owner_scope_id" UUID,
    "time_zone" VARCHAR(80),
    "working_calendar" JSONB,
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "effective_to" TIMESTAMPTZ(6),
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rule_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_exceptions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "mission_id" UUID NOT NULL,
    "stop_id" UUID,
    "rule_code" VARCHAR(120) NOT NULL,
    "rule_configuration_id" UUID,
    "active_key" VARCHAR(300),
    "occurrence_key" VARCHAR(300) NOT NULL,
    "status" "ExceptionStatus" NOT NULL DEFAULT 'OPEN',
    "severity" "ExceptionSeverity",
    "is_blocking" BOOLEAN NOT NULL DEFAULT false,
    "owner_user_id" UUID,
    "owner_scope_type" "ScopeType",
    "owner_scope_id" UUID,
    "client_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "carrier_id" UUID,
    "vehicle_id" UUID,
    "driver_id" UUID,
    "scheduled_at" TIMESTAMPTZ(6),
    "actual_at" TIMESTAMPTZ(6),
    "delay_minutes" INTEGER,
    "actual_quantity" DECIMAL(14,3),
    "tolerance_quantity" DECIMAL(14,3),
    "context" JSONB NOT NULL DEFAULT '{}',
    "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_detected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),
    "resolution_notes" VARCHAR(2000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "operational_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exception_stops" (
    "exception_id" UUID NOT NULL,
    "stop_id" UUID NOT NULL,

    CONSTRAINT "exception_stops_pkey" PRIMARY KEY ("exception_id","stop_id")
);

-- CreateTable
CREATE TABLE "exception_evidence" (
    "exception_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "purpose" VARCHAR(240),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exception_evidence_pkey" PRIMARY KEY ("exception_id","document_id")
);

-- CreateTable
CREATE TABLE "root_causes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "exception_id" UUID NOT NULL,
    "category" VARCHAR(120) NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "confirmed_by_user_id" UUID,
    "confirmed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "root_causes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decisions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "exception_id" UUID NOT NULL,
    "decision_text" VARCHAR(4000) NOT NULL,
    "decided_by_user_id" UUID NOT NULL,
    "decided_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corrective_actions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "decision_id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "action_text" VARCHAR(4000) NOT NULL,
    "due_at" TIMESTAMPTZ(6),
    "status" "ActionStatus" NOT NULL DEFAULT 'OPEN',
    "completed_at" TIMESTAMPTZ(6),
    "completed_by_user_id" UUID,
    "completion_notes" VARCHAR(2000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "corrective_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "exception_id" UUID NOT NULL,
    "user_id" UUID,
    "channel" VARCHAR(40) NOT NULL DEFAULT 'IN_APP',
    "status" "AlertStatus" NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMPTZ(6),
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_definitions" (
    "code" VARCHAR(120) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "kpi_definitions_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "kpi_configurations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "kpi_code" VARCHAR(120) NOT NULL,
    "scope_type" "RuleScopeType" NOT NULL,
    "scope_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "formula" JSONB,
    "eligibility" JSONB,
    "data_sources" JSONB,
    "period_definition" JSONB,
    "targets" JSONB,
    "rounding_mode" VARCHAR(40),
    "decimal_scale" INTEGER,
    "calculation_frequency" VARCHAR(80),
    "time_zone" VARCHAR(80),
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "effective_to" TIMESTAMPTZ(6),
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "kpi_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rule_configurations_organization_id_rule_code_effective_fro_idx" ON "rule_configurations"("organization_id", "rule_code", "effective_from", "effective_to");

-- CreateIndex
CREATE INDEX "rule_configurations_scope_type_scope_id_idx" ON "rule_configurations"("scope_type", "scope_id");

-- CreateIndex
CREATE UNIQUE INDEX "rule_configurations_organization_id_rule_code_scope_type_sc_key" ON "rule_configurations"("organization_id", "rule_code", "scope_type", "scope_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "operational_exceptions_active_key_key" ON "operational_exceptions"("active_key");

-- CreateIndex
CREATE INDEX "operational_exceptions_organization_id_status_severity_idx" ON "operational_exceptions"("organization_id", "status", "severity");

-- CreateIndex
CREATE INDEX "operational_exceptions_mission_id_status_idx" ON "operational_exceptions"("mission_id", "status");

-- CreateIndex
CREATE INDEX "operational_exceptions_rule_code_opened_at_idx" ON "operational_exceptions"("rule_code", "opened_at");

-- CreateIndex
CREATE INDEX "operational_exceptions_owner_user_id_status_idx" ON "operational_exceptions"("owner_user_id", "status");

-- CreateIndex
CREATE INDEX "root_causes_exception_id_created_at_idx" ON "root_causes"("exception_id", "created_at");

-- CreateIndex
CREATE INDEX "decisions_exception_id_decided_at_idx" ON "decisions"("exception_id", "decided_at");

-- CreateIndex
CREATE INDEX "corrective_actions_organization_id_status_due_at_idx" ON "corrective_actions"("organization_id", "status", "due_at");

-- CreateIndex
CREATE INDEX "corrective_actions_decision_id_status_idx" ON "corrective_actions"("decision_id", "status");

-- CreateIndex
CREATE INDEX "alerts_organization_id_status_created_at_idx" ON "alerts"("organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "alerts_user_id_status_idx" ON "alerts"("user_id", "status");

CREATE INDEX "kpi_configurations_organization_id_kpi_code_effective_fro_idx" ON "kpi_configurations"("organization_id", "kpi_code", "effective_from", "effective_to");
CREATE INDEX "kpi_configurations_scope_type_scope_id_idx" ON "kpi_configurations"("scope_type", "scope_id");
CREATE UNIQUE INDEX "kpi_configurations_organization_id_kpi_code_scope_type_sco_key" ON "kpi_configurations"("organization_id", "kpi_code", "scope_type", "scope_id", "version");

-- AddForeignKey
ALTER TABLE "rule_configurations" ADD CONSTRAINT "rule_configurations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_configurations" ADD CONSTRAINT "rule_configurations_rule_code_fkey" FOREIGN KEY ("rule_code") REFERENCES "rule_definitions"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_configurations" ADD CONSTRAINT "rule_configurations_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_configurations" ADD CONSTRAINT "rule_configurations_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_exceptions" ADD CONSTRAINT "operational_exceptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_exceptions" ADD CONSTRAINT "operational_exceptions_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_exceptions" ADD CONSTRAINT "operational_exceptions_stop_id_fkey" FOREIGN KEY ("stop_id") REFERENCES "mission_stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_exceptions" ADD CONSTRAINT "operational_exceptions_rule_code_fkey" FOREIGN KEY ("rule_code") REFERENCES "rule_definitions"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_exceptions" ADD CONSTRAINT "operational_exceptions_rule_configuration_id_fkey" FOREIGN KEY ("rule_configuration_id") REFERENCES "rule_configurations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_exceptions" ADD CONSTRAINT "operational_exceptions_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exception_stops" ADD CONSTRAINT "exception_stops_exception_id_fkey" FOREIGN KEY ("exception_id") REFERENCES "operational_exceptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exception_stops" ADD CONSTRAINT "exception_stops_stop_id_fkey" FOREIGN KEY ("stop_id") REFERENCES "mission_stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exception_evidence" ADD CONSTRAINT "exception_evidence_exception_id_fkey" FOREIGN KEY ("exception_id") REFERENCES "operational_exceptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exception_evidence" ADD CONSTRAINT "exception_evidence_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "root_causes" ADD CONSTRAINT "root_causes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "root_causes" ADD CONSTRAINT "root_causes_exception_id_fkey" FOREIGN KEY ("exception_id") REFERENCES "operational_exceptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "root_causes" ADD CONSTRAINT "root_causes_confirmed_by_user_id_fkey" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_exception_id_fkey" FOREIGN KEY ("exception_id") REFERENCES "operational_exceptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_decided_by_user_id_fkey" FOREIGN KEY ("decided_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrective_actions" ADD CONSTRAINT "corrective_actions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrective_actions" ADD CONSTRAINT "corrective_actions_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "decisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrective_actions" ADD CONSTRAINT "corrective_actions_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrective_actions" ADD CONSTRAINT "corrective_actions_completed_by_user_id_fkey" FOREIGN KEY ("completed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_exception_id_fkey" FOREIGN KEY ("exception_id") REFERENCES "operational_exceptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "kpi_configurations" ADD CONSTRAINT "kpi_configurations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "kpi_configurations" ADD CONSTRAINT "kpi_configurations_kpi_code_fkey" FOREIGN KEY ("kpi_code") REFERENCES "kpi_definitions"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "kpi_configurations" ADD CONSTRAINT "kpi_configurations_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed product-level definitions. Thresholds remain overrideable by effective-dated scoped configuration.
INSERT INTO "rule_definitions" (
  "code", "name", "description", "default_threshold_minutes",
  "default_quantity_tolerance", "enabled_by_default", "updated_at"
) VALUES
  ('LOADING_DELAY', 'Loading delay', 'Actual loading exceeds scheduled loading by the effective threshold.', 30, NULL, true, CURRENT_TIMESTAMP),
  ('DEPARTURE_DELAY', 'Departure delay', 'Actual departure exceeds scheduled departure by the effective threshold.', NULL, NULL, false, CURRENT_TIMESTAMP),
  ('STOP_ARRIVAL_DELAY', 'Stop arrival delay', 'Actual stop arrival exceeds expected arrival by the effective threshold.', NULL, NULL, false, CURRENT_TIMESTAMP),
  ('SHORTAGE', 'Shortage', 'Persisted shortage quantity exceeds the effective tolerance.', NULL, 0, true, CURRENT_TIMESTAMP),
  ('REJECTION', 'Rejection', 'Persisted rejected quantity exceeds the effective tolerance.', NULL, 0, true, CURRENT_TIMESTAMP),
  ('MISSING_OPERATIONAL_DATA', 'Missing operational data', 'A required schedule or actual operational timestamp is absent at evaluation time.', NULL, NULL, true, CURRENT_TIMESTAMP);

-- Candidate KPI registry only. No formula or calculation is activated by these definitions.
INSERT INTO "kpi_definitions" ("code", "name", "description", "updated_at") VALUES
  ('ON_TIME_VEHICLE_ARRIVAL', 'On-Time Vehicle Arrival', 'Candidate KPI requiring an approved eligibility and timing contract.', CURRENT_TIMESTAMP),
  ('ON_TIME_LOADING', 'On-Time Loading', 'Candidate KPI requiring an approved eligibility and timing contract.', CURRENT_TIMESTAMP),
  ('ON_TIME_DEPARTURE', 'On-Time Departure', 'Candidate KPI requiring an approved eligibility and timing contract.', CURRENT_TIMESTAMP),
  ('ON_TIME_DELIVERY', 'On-Time Delivery', 'Candidate KPI requiring an approved stop/mission aggregation contract.', CURRENT_TIMESTAMP),
  ('POD_COMPLETION', 'POD Completion', 'Candidate KPI requiring approved document validity and denominator rules.', CURRENT_TIMESTAMP),
  ('SHORTAGE_RATE', 'Shortage Rate', 'Candidate KPI requiring approved units, weighting, and tolerance rules.', CURRENT_TIMESTAMP),
  ('EXCEPTION_RATE', 'Exception Rate', 'Candidate KPI requiring approved qualifying-exception and eligibility rules.', CURRENT_TIMESTAMP),
  ('CARRIER_SERVICE_LEVEL', 'Carrier Service Level', 'Candidate composite KPI requiring approved components and weights.', CURRENT_TIMESTAMP);

INSERT INTO "permissions" ("id", "code", "description") VALUES
  (gen_random_uuid(), 'rule.read', 'Read operational rule configurations'),
  (gen_random_uuid(), 'rule.manage', 'Create effective-dated operational rule configurations'),
  (gen_random_uuid(), 'rule.evaluate', 'Run bounded manual operational rule reevaluation'),
  (gen_random_uuid(), 'exception.read', 'Read operational exceptions'),
  (gen_random_uuid(), 'exception.manage', 'Assign, classify, resolve, and attach evidence to exceptions'),
  (gen_random_uuid(), 'root_cause.create', 'Record and confirm exception root causes'),
  (gen_random_uuid(), 'decision.create', 'Record exception decisions'),
  (gen_random_uuid(), 'action.create', 'Create corrective actions'),
  (gen_random_uuid(), 'action.update', 'Complete corrective actions'),
  (gen_random_uuid(), 'alert.read', 'Read operational alerts'),
  (gen_random_uuid(), 'alert.update', 'Mark operational alerts as read'),
  (gen_random_uuid(), 'kpi.read', 'Read KPI definitions and configuration versions'),
  (gen_random_uuid(), 'kpi.manage', 'Create effective-dated KPI configuration versions')
ON CONFLICT ("code") DO NOTHING;
