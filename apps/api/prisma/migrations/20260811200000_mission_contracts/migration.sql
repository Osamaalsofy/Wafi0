ALTER TABLE "missions" ADD COLUMN "contract_id" UUID;

CREATE INDEX "missions_contract_id_status_idx" ON "missions"("contract_id", "status");

ALTER TABLE "missions" ADD CONSTRAINT "missions_contract_id_organization_id_fkey"
FOREIGN KEY ("contract_id", "organization_id")
REFERENCES "operational_contracts"("id", "organization_id")
ON DELETE RESTRICT ON UPDATE CASCADE;
