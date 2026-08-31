CREATE TABLE "carriers" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "code" VARCHAR(64) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "settings" JSONB NOT NULL DEFAULT '{}',
  "archived_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "carriers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "carriers_organization_id_code_key" ON "carriers"("organization_id", "code");
CREATE INDEX "carriers_organization_id_status_idx" ON "carriers"("organization_id", "status");
CREATE INDEX "carriers_organization_id_name_idx" ON "carriers"("organization_id", "name");
ALTER TABLE "carriers" ADD CONSTRAINT "carriers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
