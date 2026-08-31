CREATE TYPE "AlertDeliveryOutcome" AS ENUM ('SENT', 'FAILED');

ALTER TABLE "alerts"
ADD COLUMN "escalation_due_at" TIMESTAMPTZ(6),
ADD COLUMN "escalated_at" TIMESTAMPTZ(6);

UPDATE "alerts" SET "escalation_due_at" = "created_at" + INTERVAL '14 minutes';
ALTER TABLE "alerts" ALTER COLUMN "escalation_due_at" SET NOT NULL;

CREATE TABLE "alert_delivery_attempts" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "alert_id" UUID NOT NULL,
  "attempt_no" INTEGER NOT NULL,
  "channel" VARCHAR(40) NOT NULL DEFAULT 'EMAIL',
  "outcome" "AlertDeliveryOutcome" NOT NULL,
  "attempted_at" TIMESTAMPTZ(6) NOT NULL,
  "error" VARCHAR(2000),
  "next_attempt_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "alert_delivery_attempts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "alert_escalations" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "alert_id" UUID NOT NULL,
  "recipient_user_id" UUID NOT NULL,
  "escalated_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "alert_escalations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "alert_delivery_attempts_alert_id_attempt_no_key" ON "alert_delivery_attempts"("alert_id", "attempt_no");
CREATE INDEX "alert_delivery_attempts_organization_id_next_attempt_at_idx" ON "alert_delivery_attempts"("organization_id", "next_attempt_at");
CREATE UNIQUE INDEX "alert_escalations_alert_id_recipient_user_id_key" ON "alert_escalations"("alert_id", "recipient_user_id");
CREATE INDEX "alert_escalations_organization_id_escalated_at_idx" ON "alert_escalations"("organization_id", "escalated_at");
CREATE INDEX "alerts_organization_id_escalation_due_at_escalated_at_idx" ON "alerts"("organization_id", "escalation_due_at", "escalated_at");

ALTER TABLE "alert_delivery_attempts" ADD CONSTRAINT "alert_delivery_attempts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "alert_delivery_attempts" ADD CONSTRAINT "alert_delivery_attempts_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "alert_escalations" ADD CONSTRAINT "alert_escalations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "alert_escalations" ADD CONSTRAINT "alert_escalations_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "alert_escalations" ADD CONSTRAINT "alert_escalations_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "code", "description") VALUES
  (gen_random_uuid(), 'alert.deliver', 'Record idempotent external alert delivery attempts'),
  (gen_random_uuid(), 'alert.escalate', 'Run bounded due operational alert escalation')
ON CONFLICT ("code") DO NOTHING;
