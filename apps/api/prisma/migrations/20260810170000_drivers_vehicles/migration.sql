CREATE UNIQUE INDEX "carriers_id_organization_id_key" ON "carriers"("id", "organization_id");

CREATE TABLE "drivers" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "carrier_id" UUID NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "phone" VARCHAR(32),
  "license_no" VARCHAR(80),
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "archived_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "drivers_carrier_id_license_no_key" ON "drivers"("carrier_id", "license_no");
CREATE INDEX "drivers_organization_id_status_idx" ON "drivers"("organization_id", "status");
CREATE INDEX "drivers_carrier_id_status_idx" ON "drivers"("carrier_id", "status");
CREATE INDEX "drivers_organization_id_name_idx" ON "drivers"("organization_id", "name");
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_carrier_id_organization_id_fkey" FOREIGN KEY ("carrier_id", "organization_id") REFERENCES "carriers"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "vehicles" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "carrier_id" UUID NOT NULL,
  "plate_no" VARCHAR(40) NOT NULL,
  "vehicle_type" VARCHAR(80),
  "capacity" DECIMAL(14,3),
  "capacity_unit" VARCHAR(32),
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "archived_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "vehicles_carrier_id_plate_no_key" ON "vehicles"("carrier_id", "plate_no");
CREATE INDEX "vehicles_organization_id_status_idx" ON "vehicles"("organization_id", "status");
CREATE INDEX "vehicles_carrier_id_status_idx" ON "vehicles"("carrier_id", "status");
CREATE INDEX "vehicles_organization_id_plate_no_idx" ON "vehicles"("organization_id", "plate_no");
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_carrier_id_organization_id_fkey" FOREIGN KEY ("carrier_id", "organization_id") REFERENCES "carriers"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
