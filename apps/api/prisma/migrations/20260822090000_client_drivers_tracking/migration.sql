ALTER TABLE "drivers"
  ADD COLUMN "client_id" UUID,
  ADD COLUMN "tracking_number" VARCHAR(80);

ALTER TABLE "drivers"
  ADD CONSTRAINT "drivers_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "drivers_organization_id_tracking_number_key"
  ON "drivers"("organization_id", "tracking_number");

CREATE INDEX "drivers_client_id_status_idx"
  ON "drivers"("client_id", "status");
