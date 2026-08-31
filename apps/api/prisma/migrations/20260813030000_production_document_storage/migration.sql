CREATE TYPE "MalwareScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'FAILED');
ALTER TABLE "documents"
  ADD COLUMN "checksum_sha256" CHAR(64),
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "replaces_document_id" UUID,
  ADD COLUMN "retention_until" DATE,
  ADD COLUMN "malware_scan_status" "MalwareScanStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "malware_scanned_at" TIMESTAMPTZ(6);
CREATE INDEX "documents_replaces_document_id_idx" ON "documents"("replaces_document_id");
CREATE INDEX "documents_organization_id_malware_scan_status_idx" ON "documents"("organization_id", "malware_scan_status");
ALTER TABLE "documents" ADD CONSTRAINT "documents_replaces_document_id_fkey" FOREIGN KEY ("replaces_document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
