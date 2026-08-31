CREATE UNIQUE INDEX "clients_id_organization_id_key" ON "clients"("id", "organization_id");

CREATE TABLE "warehouses" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "client_id" UUID NOT NULL,
  "code" VARCHAR(64) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "address" TEXT,
  "latitude" DECIMAL(9,6),
  "longitude" DECIMAL(9,6),
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "archived_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "warehouses_client_id_code_key" ON "warehouses"("client_id", "code");
CREATE INDEX "warehouses_organization_id_status_idx" ON "warehouses"("organization_id", "status");
CREATE INDEX "warehouses_client_id_status_idx" ON "warehouses"("client_id", "status");
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_client_id_organization_id_fkey" FOREIGN KEY ("client_id", "organization_id") REFERENCES "clients"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "branches" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "client_id" UUID NOT NULL,
  "code" VARCHAR(64) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "address" TEXT,
  "latitude" DECIMAL(9,6),
  "longitude" DECIMAL(9,6),
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "archived_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "branches_client_id_code_key" ON "branches"("client_id", "code");
CREATE INDEX "branches_organization_id_status_idx" ON "branches"("organization_id", "status");
CREATE INDEX "branches_client_id_status_idx" ON "branches"("client_id", "status");
ALTER TABLE "branches" ADD CONSTRAINT "branches_client_id_organization_id_fkey" FOREIGN KEY ("client_id", "organization_id") REFERENCES "clients"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
