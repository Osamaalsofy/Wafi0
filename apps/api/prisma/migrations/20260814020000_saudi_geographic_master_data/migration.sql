CREATE TYPE "GeofenceType" AS ENUM ('POINT', 'POLYGON', 'MULTIPOLYGON');

CREATE TABLE "countries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" CHAR(2) NOT NULL,
  "name_ar" VARCHAR(120) NOT NULL,
  "name_en" VARCHAR(120) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "geographic_regions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "country_id" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "name_ar" VARCHAR(160) NOT NULL,
  "name_en" VARCHAR(160) NOT NULL,
  "latitude" DECIMAL(9,6) NOT NULL,
  "longitude" DECIMAL(9,6) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "geographic_regions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "governorates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "region_id" UUID NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "name_ar" VARCHAR(160) NOT NULL,
  "name_en" VARCHAR(160) NOT NULL,
  "latitude" DECIMAL(9,6) NOT NULL,
  "longitude" DECIMAL(9,6) NOT NULL,
  "timezone" VARCHAR(80) NOT NULL DEFAULT 'Asia/Riyadh',
  "geofence_type" "GeofenceType" NOT NULL DEFAULT 'POINT',
  "geofence" JSONB,
  "coordinate_source" VARCHAR(120) NOT NULL,
  "is_major" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "governorates_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "warehouses" ADD COLUMN "governorate_id" UUID;
ALTER TABLE "branches" ADD COLUMN "governorate_id" UUID;

CREATE UNIQUE INDEX "countries_code_key" ON "countries"("code");
CREATE INDEX "countries_is_active_idx" ON "countries"("is_active");
CREATE UNIQUE INDEX "geographic_regions_code_key" ON "geographic_regions"("code");
CREATE INDEX "geographic_regions_country_id_is_active_idx" ON "geographic_regions"("country_id", "is_active");
CREATE INDEX "geographic_regions_name_ar_idx" ON "geographic_regions"("name_ar");
CREATE INDEX "geographic_regions_name_en_idx" ON "geographic_regions"("name_en");
CREATE UNIQUE INDEX "governorates_code_key" ON "governorates"("code");
CREATE INDEX "governorates_region_id_is_active_idx" ON "governorates"("region_id", "is_active");
CREATE INDEX "governorates_name_ar_idx" ON "governorates"("name_ar");
CREATE INDEX "governorates_name_en_idx" ON "governorates"("name_en");
CREATE INDEX "governorates_is_active_is_major_idx" ON "governorates"("is_active", "is_major");
CREATE INDEX "warehouses_governorate_id_idx" ON "warehouses"("governorate_id");
CREATE INDEX "branches_governorate_id_idx" ON "branches"("governorate_id");

ALTER TABLE "geographic_regions" ADD CONSTRAINT "geographic_regions_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "governorates" ADD CONSTRAINT "governorates_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "geographic_regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_governorate_id_fkey" FOREIGN KEY ("governorate_id") REFERENCES "governorates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "branches" ADD CONSTRAINT "branches_governorate_id_fkey" FOREIGN KEY ("governorate_id") REFERENCES "governorates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
