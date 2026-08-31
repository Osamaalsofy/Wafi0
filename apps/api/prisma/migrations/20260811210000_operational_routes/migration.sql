CREATE TABLE "operational_routes" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "client_id" UUID NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "city_region" VARCHAR(160) NOT NULL,
  "time_zone" VARCHAR(80) NOT NULL,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "operational_routes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "route_stops" (
  "id" UUID NOT NULL,
  "route_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "route_stops_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "operational_routes_organization_id_code_key" ON "operational_routes"("organization_id", "code");
CREATE UNIQUE INDEX "operational_routes_id_organization_id_key" ON "operational_routes"("id", "organization_id");
CREATE INDEX "operational_routes_organization_id_status_idx" ON "operational_routes"("organization_id", "status");
CREATE INDEX "operational_routes_client_id_status_idx" ON "operational_routes"("client_id", "status");
CREATE UNIQUE INDEX "route_stops_route_id_sequence_key" ON "route_stops"("route_id", "sequence");
CREATE INDEX "route_stops_organization_id_branch_id_idx" ON "route_stops"("organization_id", "branch_id");

ALTER TABLE "operational_routes" ADD CONSTRAINT "operational_routes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "operational_routes" ADD CONSTRAINT "operational_routes_client_id_organization_id_fkey" FOREIGN KEY ("client_id", "organization_id") REFERENCES "clients"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "operational_routes" ADD CONSTRAINT "operational_routes_created_by_user_id_organization_id_fkey" FOREIGN KEY ("created_by_user_id", "organization_id") REFERENCES "users"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_route_id_organization_id_fkey" FOREIGN KEY ("route_id", "organization_id") REFERENCES "operational_routes"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_branch_id_organization_id_fkey" FOREIGN KEY ("branch_id", "organization_id") REFERENCES "branches"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "code", "description") VALUES
  (gen_random_uuid(), 'route.read', 'Read operational routes'),
  (gen_random_uuid(), 'route.manage', 'Create operational routes')
ON CONFLICT ("code") DO NOTHING;
