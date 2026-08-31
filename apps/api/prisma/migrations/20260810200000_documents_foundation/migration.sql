CREATE TYPE "DocumentType" AS ENUM ('WAYBILL', 'GATE_PASS', 'POD', 'SHORTAGE_PROOF', 'RETURN_PROOF', 'OTHER');
CREATE TYPE "DocumentVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

CREATE TABLE "documents" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "mission_id" UUID NOT NULL,
  "stop_id" UUID,
  "type" "DocumentType" NOT NULL,
  "storage_key" VARCHAR(500) NOT NULL,
  "original_file_name" VARCHAR(255) NOT NULL,
  "mime_type" VARCHAR(120) NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "verification_status" "DocumentVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "uploaded_by_user_id" UUID NOT NULL,
  "verified_by_user_id" UUID,
  "verified_at" TIMESTAMPTZ(6),
  "verification_notes" VARCHAR(1000),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "documents_size_bytes_check" CHECK ("size_bytes" > 0),
  CONSTRAINT "documents_verification_check" CHECK (
    ("verification_status" = 'PENDING' AND "verified_by_user_id" IS NULL AND "verified_at" IS NULL)
    OR ("verification_status" <> 'PENDING' AND "verified_by_user_id" IS NOT NULL AND "verified_at" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "documents_storage_key_key" ON "documents"("storage_key");
CREATE INDEX "documents_organization_id_created_at_idx" ON "documents"("organization_id", "created_at");
CREATE INDEX "documents_mission_id_type_idx" ON "documents"("mission_id", "type");
CREATE INDEX "documents_stop_id_type_idx" ON "documents"("stop_id", "type");
CREATE INDEX "documents_organization_id_verification_status_idx" ON "documents"("organization_id", "verification_status");

ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_mission_id_organization_id_fkey" FOREIGN KEY ("mission_id", "organization_id") REFERENCES "missions"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_stop_id_organization_id_fkey" FOREIGN KEY ("stop_id", "organization_id") REFERENCES "mission_stops"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_user_id_organization_id_fkey" FOREIGN KEY ("uploaded_by_user_id", "organization_id") REFERENCES "users"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_verified_by_user_id_organization_id_fkey" FOREIGN KEY ("verified_by_user_id", "organization_id") REFERENCES "users"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
