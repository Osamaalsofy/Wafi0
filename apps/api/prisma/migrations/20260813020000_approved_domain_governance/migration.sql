ALTER TYPE "ContractStatus" RENAME TO "ContractStatus_old";
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'TERMINATED');
ALTER TABLE "operational_contracts" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "operational_contracts"
  ALTER COLUMN "status" TYPE "ContractStatus"
  USING (CASE WHEN "status"::text = 'INACTIVE' THEN 'SUSPENDED' ELSE "status"::text END)::"ContractStatus";
ALTER TABLE "operational_contracts" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
DROP TYPE "ContractStatus_old";

CREATE TYPE "QuantityUnit" AS ENUM ('UNIT', 'KG', 'TON', 'LITER', 'PALLET', 'CARTON');
ALTER TABLE "mission_stops"
  ADD COLUMN "actual_qty" DECIMAL(14,3),
  ADD COLUMN "quantity_unit" "QuantityUnit";
UPDATE "mission_stops" SET "actual_qty" = "received_qty" WHERE "received_qty" IS NOT NULL;
ALTER TABLE "mission_stops" ADD CONSTRAINT "mission_stops_quantities_require_unit_check" CHECK (
  ("expected_qty" IS NULL AND "actual_qty" IS NULL AND "shortage_qty" IS NULL AND "rejected_qty" IS NULL)
  OR "quantity_unit" IS NOT NULL
);

CREATE TABLE "root_cause_categories" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "code" VARCHAR(120) NOT NULL,
  "name_en" VARCHAR(160) NOT NULL,
  "name_ar" VARCHAR(160) NOT NULL,
  "parent_id" UUID,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "retired_at" TIMESTAMPTZ(6),
  CONSTRAINT "root_cause_categories_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "root_causes" ADD COLUMN "category_id" UUID;
CREATE UNIQUE INDEX "root_cause_categories_organization_id_code_key" ON "root_cause_categories"("organization_id", "code");
CREATE UNIQUE INDEX "root_cause_categories_id_organization_id_key" ON "root_cause_categories"("id", "organization_id");
CREATE INDEX "root_cause_categories_organization_id_is_active_idx" ON "root_cause_categories"("organization_id", "is_active");
ALTER TABLE "root_cause_categories" ADD CONSTRAINT "root_cause_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "root_cause_categories" ADD CONSTRAINT "root_cause_categories_parent_id_organization_id_fkey" FOREIGN KEY ("parent_id", "organization_id") REFERENCES "root_cause_categories"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "root_causes" ADD CONSTRAINT "root_causes_category_id_organization_id_fkey" FOREIGN KEY ("category_id", "organization_id") REFERENCES "root_cause_categories"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "root_cause_categories" ("id", "organization_id", "code", "name_en", "name_ar")
SELECT gen_random_uuid(), o."id", v.code, v.name_en, v.name_ar
FROM "organizations" o
CROSS JOIN (VALUES
 ('TRAFFIC','Traffic','الازدحام المروري'), ('WEATHER','Weather','الطقس'),
 ('VEHICLE_BREAKDOWN','Vehicle breakdown','تعطل المركبة'), ('DRIVER','Driver','السائق'),
 ('CUSTOMER_DELAY','Customer delay','تأخير العميل'), ('WAREHOUSE_DELAY','Warehouse delay','تأخير المستودع'),
 ('LOADING_DELAY','Loading delay','تأخير التحميل'), ('DOCUMENTATION','Documentation','المستندات'),
 ('ROUTE_DEVIATION','Route deviation','انحراف المسار'), ('ACCIDENT','Accident','حادث'),
 ('TEMPERATURE','Temperature','درجة الحرارة'), ('CAPACITY','Capacity','السعة'),
 ('SYSTEM','System','النظام'), ('OTHER','Other','أخرى')
) AS v(code, name_en, name_ar);

UPDATE "root_causes" rc SET "category_id" = c."id"
FROM "root_cause_categories" c
WHERE c."organization_id" = rc."organization_id" AND c."code" = rc."category";

INSERT INTO "permissions" ("id", "code", "description") VALUES
 (gen_random_uuid(), 'root_cause.manage', 'Manage version-safe root cause taxonomy')
ON CONFLICT ("code") DO NOTHING;

CREATE TYPE "ClosurePolicyStatus" AS ENUM ('DRAFT', 'APPROVED', 'ACTIVE', 'RETIRED');
ALTER TABLE "closure_policies"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "status" "ClosurePolicyStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "authored_by_user_id" UUID,
  ADD COLUMN "approved_by_user_id" UUID,
  ADD COLUMN "approved_at" TIMESTAMPTZ(6);
UPDATE "closure_policies" SET "status" = CASE WHEN "is_active" THEN 'ACTIVE'::"ClosurePolicyStatus" ELSE 'DRAFT'::"ClosurePolicyStatus" END;
UPDATE "closure_policies" cp SET "authored_by_user_id" = COALESCE(cp."activated_by_user_id", (SELECT u."id" FROM "users" u WHERE u."organization_id" = cp."organization_id" ORDER BY u."created_at" LIMIT 1));
ALTER TABLE "closure_policies" ALTER COLUMN "authored_by_user_id" SET NOT NULL;
DROP INDEX "closure_policies_client_id_stage_key";
CREATE UNIQUE INDEX "closure_policies_client_id_stage_version_key" ON "closure_policies"("client_id", "stage", "version");
ALTER TABLE "closure_policies" ADD CONSTRAINT "closure_policies_authored_by_user_id_organization_id_fkey" FOREIGN KEY ("authored_by_user_id", "organization_id") REFERENCES "users"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "closure_policies" ADD CONSTRAINT "closure_policies_approved_by_user_id_organization_id_fkey" FOREIGN KEY ("approved_by_user_id", "organization_id") REFERENCES "users"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "missions" ADD COLUMN "operational_closure_policy_id" UUID, ADD COLUMN "accounting_closure_policy_id" UUID;
ALTER TABLE "missions" ADD CONSTRAINT "missions_operational_closure_policy_id_fkey" FOREIGN KEY ("operational_closure_policy_id") REFERENCES "closure_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "missions" ADD CONSTRAINT "missions_accounting_closure_policy_id_fkey" FOREIGN KEY ("accounting_closure_policy_id") REFERENCES "closure_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
