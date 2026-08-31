-- CreateEnum
CREATE TYPE "MissionStatus" AS ENUM ('DRAFT', 'ASSIGNED', 'WAITING_FOR_VEHICLE', 'VEHICLE_ARRIVED', 'LOADING', 'LOADED', 'DEPARTED', 'IN_TRANSIT', 'AT_STOP', 'DELIVERING', 'DELIVERED', 'OPERATIONALLY_CLOSED', 'ACCOUNTING_READY', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MissionStopStatus" AS ENUM ('PENDING', 'ARRIVED', 'UNLOADING', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "missions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "mission_no" VARCHAR(80) NOT NULL,
    "client_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "carrier_id" UUID,
    "vehicle_id" UUID,
    "driver_id" UUID,
    "cargo_type" VARCHAR(120),
    "status" "MissionStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduled_loading_at" TIMESTAMPTZ(6),
    "actual_loading_at" TIMESTAMPTZ(6),
    "scheduled_departure_at" TIMESTAMPTZ(6),
    "actual_departure_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "missions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mission_stops" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "mission_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "expected_arrival" TIMESTAMPTZ(6),
    "actual_arrival" TIMESTAMPTZ(6),
    "unloading_started_at" TIMESTAMPTZ(6),
    "unloading_completed_at" TIMESTAMPTZ(6),
    "expected_qty" DECIMAL(14,3),
    "received_qty" DECIMAL(14,3),
    "rejected_qty" DECIMAL(14,3),
    "shortage_qty" DECIMAL(14,3),
    "status" "MissionStopStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "mission_stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mission_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "mission_id" UUID NOT NULL,
    "stop_id" UUID,
    "actor_user_id" UUID,
    "event_type" VARCHAR(120) NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" VARCHAR(40) NOT NULL DEFAULT 'API',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mission_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "missions_organization_id_status_idx" ON "missions"("organization_id", "status");
CREATE INDEX "missions_organization_id_scheduled_loading_at_idx" ON "missions"("organization_id", "scheduled_loading_at");
CREATE INDEX "missions_client_id_status_idx" ON "missions"("client_id", "status");
CREATE INDEX "missions_warehouse_id_status_idx" ON "missions"("warehouse_id", "status");
CREATE INDEX "missions_carrier_id_status_idx" ON "missions"("carrier_id", "status");
CREATE UNIQUE INDEX "missions_organization_id_mission_no_key" ON "missions"("organization_id", "mission_no");
CREATE UNIQUE INDEX "missions_id_organization_id_key" ON "missions"("id", "organization_id");
CREATE INDEX "mission_stops_organization_id_status_idx" ON "mission_stops"("organization_id", "status");
CREATE INDEX "mission_stops_branch_id_status_idx" ON "mission_stops"("branch_id", "status");
CREATE UNIQUE INDEX "mission_stops_mission_id_sequence_key" ON "mission_stops"("mission_id", "sequence");
CREATE UNIQUE INDEX "mission_stops_id_organization_id_key" ON "mission_stops"("id", "organization_id");
CREATE INDEX "mission_events_mission_id_occurred_at_idx" ON "mission_events"("mission_id", "occurred_at");
CREATE INDEX "mission_events_organization_id_event_type_occurred_at_idx" ON "mission_events"("organization_id", "event_type", "occurred_at");
CREATE UNIQUE INDEX "branches_id_organization_id_key" ON "branches"("id", "organization_id");
CREATE UNIQUE INDEX "drivers_id_organization_id_key" ON "drivers"("id", "organization_id");
CREATE UNIQUE INDEX "vehicles_id_organization_id_key" ON "vehicles"("id", "organization_id");
CREATE UNIQUE INDEX "warehouses_id_organization_id_key" ON "warehouses"("id", "organization_id");
CREATE UNIQUE INDEX "users_id_organization_id_key" ON "users"("id", "organization_id");

ALTER TABLE "missions" ADD CONSTRAINT "missions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "missions" ADD CONSTRAINT "missions_client_id_organization_id_fkey" FOREIGN KEY ("client_id", "organization_id") REFERENCES "clients"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "missions" ADD CONSTRAINT "missions_warehouse_id_organization_id_fkey" FOREIGN KEY ("warehouse_id", "organization_id") REFERENCES "warehouses"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "missions" ADD CONSTRAINT "missions_carrier_id_organization_id_fkey" FOREIGN KEY ("carrier_id", "organization_id") REFERENCES "carriers"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "missions" ADD CONSTRAINT "missions_vehicle_id_organization_id_fkey" FOREIGN KEY ("vehicle_id", "organization_id") REFERENCES "vehicles"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "missions" ADD CONSTRAINT "missions_driver_id_organization_id_fkey" FOREIGN KEY ("driver_id", "organization_id") REFERENCES "drivers"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mission_stops" ADD CONSTRAINT "mission_stops_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mission_stops" ADD CONSTRAINT "mission_stops_mission_id_organization_id_fkey" FOREIGN KEY ("mission_id", "organization_id") REFERENCES "missions"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mission_stops" ADD CONSTRAINT "mission_stops_branch_id_organization_id_fkey" FOREIGN KEY ("branch_id", "organization_id") REFERENCES "branches"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mission_events" ADD CONSTRAINT "mission_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mission_events" ADD CONSTRAINT "mission_events_mission_id_organization_id_fkey" FOREIGN KEY ("mission_id", "organization_id") REFERENCES "missions"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mission_events" ADD CONSTRAINT "mission_events_stop_id_organization_id_fkey" FOREIGN KEY ("stop_id", "organization_id") REFERENCES "mission_stops"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mission_events" ADD CONSTRAINT "mission_events_actor_user_id_organization_id_fkey" FOREIGN KEY ("actor_user_id", "organization_id") REFERENCES "users"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
