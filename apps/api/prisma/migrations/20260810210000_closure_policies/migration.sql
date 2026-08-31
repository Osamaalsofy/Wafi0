CREATE TYPE "ClosureStage" AS ENUM ('OPERATIONAL_CLOSURE', 'ACCOUNTING_READINESS');
CREATE TYPE "DocumentRequirementScope" AS ENUM ('MISSION', 'EACH_STOP');

CREATE TABLE "closure_policies" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "client_id" UUID NOT NULL,
  "stage" "ClosureStage" NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "activated_by_user_id" UUID,
  "activated_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "closure_policies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "closure_policies_activation_check" CHECK (
    ("is_active" = false AND "activated_by_user_id" IS NULL AND "activated_at" IS NULL)
    OR ("is_active" = true AND "activated_by_user_id" IS NOT NULL AND "activated_at" IS NOT NULL)
  )
);

CREATE TABLE "closure_document_requirements" (
  "id" UUID NOT NULL,
  "policy_id" UUID NOT NULL,
  "document_type" "DocumentType" NOT NULL,
  "scope" "DocumentRequirementScope" NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "closure_document_requirements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "closure_policies_client_id_stage_key" ON "closure_policies"("client_id", "stage");
CREATE INDEX "closure_policies_organization_id_is_active_idx" ON "closure_policies"("organization_id", "is_active");
CREATE UNIQUE INDEX "closure_document_requirements_policy_id_document_type_scope_key" ON "closure_document_requirements"("policy_id", "document_type", "scope");

ALTER TABLE "closure_policies" ADD CONSTRAINT "closure_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "closure_policies" ADD CONSTRAINT "closure_policies_client_id_organization_id_fkey" FOREIGN KEY ("client_id", "organization_id") REFERENCES "clients"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "closure_policies" ADD CONSTRAINT "closure_policies_activated_by_user_id_organization_id_fkey" FOREIGN KEY ("activated_by_user_id", "organization_id") REFERENCES "users"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "closure_document_requirements" ADD CONSTRAINT "closure_document_requirements_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "closure_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
