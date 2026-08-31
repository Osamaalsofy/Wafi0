UPDATE "rule_configurations"
SET "working_calendar" = '{
  "mode": "CONTINUOUS_24_7",
  "operatingDays": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"],
  "pauseSlaOnWeekends": false,
  "pauseSlaOnOfficialHolidays": false,
  "holidayWorkClassification": "OVERTIME"
}'::jsonb
WHERE "working_calendar" IS NULL;

ALTER TABLE "rule_configurations"
ALTER COLUMN "working_calendar" SET DEFAULT '{
  "mode": "CONTINUOUS_24_7",
  "operatingDays": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"],
  "pauseSlaOnWeekends": false,
  "pauseSlaOnOfficialHolidays": false,
  "holidayWorkClassification": "OVERTIME"
}'::jsonb,
ALTER COLUMN "working_calendar" SET NOT NULL;
