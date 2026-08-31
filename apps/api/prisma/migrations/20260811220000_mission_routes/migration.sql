ALTER TABLE "missions" ADD COLUMN "route_id" UUID;
ALTER TABLE "operational_exceptions" ADD COLUMN "route_id" UUID;

CREATE INDEX "missions_route_id_status_idx" ON "missions"("route_id", "status");
CREATE INDEX "operational_exceptions_route_id_status_idx" ON "operational_exceptions"("route_id", "status");

ALTER TABLE "missions"
ADD CONSTRAINT "missions_route_id_organization_id_fkey"
FOREIGN KEY ("route_id", "organization_id")
REFERENCES "operational_routes"("id", "organization_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "operational_exceptions"
ADD CONSTRAINT "operational_exceptions_route_id_organization_id_fkey"
FOREIGN KEY ("route_id", "organization_id")
REFERENCES "operational_routes"("id", "organization_id")
ON DELETE RESTRICT ON UPDATE CASCADE;
