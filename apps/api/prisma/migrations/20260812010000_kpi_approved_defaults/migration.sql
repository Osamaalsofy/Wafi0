ALTER TYPE "RuleScopeType" ADD VALUE 'DRIVER';

ALTER TABLE "kpi_configurations"
ADD COLUMN "target_percent" DECIMAL(5,2) NOT NULL DEFAULT 90;

UPDATE "kpi_configurations"
SET "calculation_frequency" = 'DAILY'
WHERE "calculation_frequency" IS NULL;

ALTER TABLE "kpi_configurations"
ALTER COLUMN "calculation_frequency" SET DEFAULT 'DAILY',
ALTER COLUMN "calculation_frequency" SET NOT NULL;
