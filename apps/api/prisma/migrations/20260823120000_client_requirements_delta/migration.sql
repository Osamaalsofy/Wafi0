CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
CREATE TYPE "MissionAssignmentKind" AS ENUM ('INITIAL', 'DRIVER_REPLACEMENT', 'VEHICLE_REPLACEMENT', 'REASSIGNMENT');

ALTER TABLE "drivers" ADD COLUMN "national_id" VARCHAR(20), ADD COLUMN "profile_photo_document_id" UUID;
CREATE UNIQUE INDEX "drivers_organization_id_national_id_key" ON "drivers"("organization_id", "national_id");

CREATE TABLE "mission_assignments" (
  "id" UUID NOT NULL, "organization_id" UUID NOT NULL, "mission_id" UUID NOT NULL,
  "carrier_id" UUID NOT NULL, "vehicle_id" UUID NOT NULL, "driver_id" UUID NOT NULL,
  "kind" "MissionAssignmentKind" NOT NULL DEFAULT 'INITIAL', "reason" VARCHAR(1000),
  "assigned_by_user_id" UUID NOT NULL, "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at" TIMESTAMPTZ(6), CONSTRAINT "mission_assignments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "mission_assignments_mission_id_assigned_at_idx" ON "mission_assignments"("mission_id", "assigned_at");
CREATE INDEX "mission_assignments_organization_id_driver_id_ended_at_idx" ON "mission_assignments"("organization_id", "driver_id", "ended_at");

CREATE TABLE "support_tickets" (
  "id" UUID NOT NULL, "organization_id" UUID NOT NULL, "mission_id" UUID NOT NULL,
  "client_id" UUID NOT NULL, "driver_id" UUID NOT NULL, "subject" VARCHAR(200) NOT NULL,
  "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN', "assigned_to_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "support_tickets_organization_id_status_updated_at_idx" ON "support_tickets"("organization_id", "status", "updated_at");
CREATE INDEX "support_tickets_client_id_updated_at_idx" ON "support_tickets"("client_id", "updated_at");

CREATE TABLE "support_messages" (
  "id" UUID NOT NULL, "ticket_id" UUID NOT NULL, "author_user_id" UUID NOT NULL, "body" TEXT NOT NULL,
  "internal_only" BOOLEAN NOT NULL DEFAULT false, "attachment_document_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "support_messages_ticket_id_created_at_idx" ON "support_messages"("ticket_id", "created_at");

CREATE TABLE "support_assignments" (
  "id" UUID NOT NULL, "ticket_id" UUID NOT NULL, "assigned_to_user_id" UUID NOT NULL,
  "assigned_by_user_id" UUID NOT NULL, "reason" VARCHAR(1000), "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at" TIMESTAMPTZ(6), CONSTRAINT "support_assignments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "support_assignments_ticket_id_assigned_at_idx" ON "support_assignments"("ticket_id", "assigned_at");

CREATE TABLE "portal_notifications" (
  "id" UUID NOT NULL, "organization_id" UUID NOT NULL, "client_id" UUID NOT NULL, "mission_id" UUID NOT NULL,
  "user_id" UUID, "type" VARCHAR(80) NOT NULL, "message" VARCHAR(500) NOT NULL, "read_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "portal_notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "portal_notifications_client_id_created_at_idx" ON "portal_notifications"("client_id", "created_at");

ALTER TABLE "mission_assignments" ADD CONSTRAINT "mission_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "mission_assignments" ADD CONSTRAINT "mission_assignments_mission_id_organization_id_fkey" FOREIGN KEY ("mission_id", "organization_id") REFERENCES "missions"("id", "organization_id") ON DELETE RESTRICT;
ALTER TABLE "mission_assignments" ADD CONSTRAINT "mission_assignments_driver_id_organization_id_fkey" FOREIGN KEY ("driver_id", "organization_id") REFERENCES "drivers"("id", "organization_id") ON DELETE RESTRICT;
ALTER TABLE "mission_assignments" ADD CONSTRAINT "mission_assignments_vehicle_id_organization_id_fkey" FOREIGN KEY ("vehicle_id", "organization_id") REFERENCES "vehicles"("id", "organization_id") ON DELETE RESTRICT;
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_mission_id_organization_id_fkey" FOREIGN KEY ("mission_id", "organization_id") REFERENCES "missions"("id", "organization_id") ON DELETE RESTRICT;
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_client_id_organization_id_fkey" FOREIGN KEY ("client_id", "organization_id") REFERENCES "clients"("id", "organization_id") ON DELETE RESTRICT;
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_driver_id_organization_id_fkey" FOREIGN KEY ("driver_id", "organization_id") REFERENCES "drivers"("id", "organization_id") ON DELETE RESTRICT;
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_user_id_organization_id_fkey" FOREIGN KEY ("assigned_to_user_id", "organization_id") REFERENCES "users"("id", "organization_id") ON DELETE RESTRICT;
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE RESTRICT;
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_attachment_document_id_fkey" FOREIGN KEY ("attachment_document_id") REFERENCES "documents"("id") ON DELETE RESTRICT;
ALTER TABLE "support_assignments" ADD CONSTRAINT "support_assignments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE RESTRICT;
ALTER TABLE "support_assignments" ADD CONSTRAINT "support_assignments_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "support_assignments" ADD CONSTRAINT "support_assignments_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "portal_notifications" ADD CONSTRAINT "portal_notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "portal_notifications" ADD CONSTRAINT "portal_notifications_client_id_organization_id_fkey" FOREIGN KEY ("client_id", "organization_id") REFERENCES "clients"("id", "organization_id") ON DELETE RESTRICT;
ALTER TABLE "portal_notifications" ADD CONSTRAINT "portal_notifications_mission_id_organization_id_fkey" FOREIGN KEY ("mission_id", "organization_id") REFERENCES "missions"("id", "organization_id") ON DELETE RESTRICT;
ALTER TABLE "portal_notifications" ADD CONSTRAINT "portal_notifications_user_id_organization_id_fkey" FOREIGN KEY ("user_id", "organization_id") REFERENCES "users"("id", "organization_id") ON DELETE RESTRICT;
