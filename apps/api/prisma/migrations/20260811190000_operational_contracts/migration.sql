CREATE TYPE "ContractCadence" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'ANNUAL');
CREATE TYPE "ContractStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'EXPIRED');
CREATE TYPE "ContractPartyType" AS ENUM ('ORGANIZATION', 'CLIENT', 'CARRIER', 'DRIVER');

CREATE TABLE "operational_contracts" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "cadence" "ContractCadence" NOT NULL,
  "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
  "effective_from" TIMESTAMPTZ(6) NOT NULL,
  "effective_to" TIMESTAMPTZ(6) NOT NULL,
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "operational_contracts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract_parties" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "party_type" "ContractPartyType" NOT NULL,
  "party_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contract_parties_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "operational_contracts_organization_id_code_key" ON "operational_contracts"("organization_id", "code");
CREATE UNIQUE INDEX "operational_contracts_id_organization_id_key" ON "operational_contracts"("id", "organization_id");
CREATE INDEX "operational_contracts_organization_id_status_effective_idx" ON "operational_contracts"("organization_id", "status", "effective_from", "effective_to");
CREATE UNIQUE INDEX "contract_parties_contract_id_party_type_party_id_key" ON "contract_parties"("contract_id", "party_type", "party_id");
CREATE INDEX "contract_parties_organization_id_party_type_party_id_idx" ON "contract_parties"("organization_id", "party_type", "party_id");

ALTER TABLE "operational_contracts" ADD CONSTRAINT "operational_contracts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "operational_contracts" ADD CONSTRAINT "operational_contracts_created_by_user_id_organization_id_fkey" FOREIGN KEY ("created_by_user_id", "organization_id") REFERENCES "users"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contract_parties" ADD CONSTRAINT "contract_parties_contract_id_organization_id_fkey" FOREIGN KEY ("contract_id", "organization_id") REFERENCES "operational_contracts"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "code", "description") VALUES
  (gen_random_uuid(), 'contract.read', 'Read operational contracts'),
  (gen_random_uuid(), 'contract.manage', 'Create operational contracts')
ON CONFLICT ("code") DO NOTHING;
