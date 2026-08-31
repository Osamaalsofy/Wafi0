-- Apply the approved Phase 5 product defaults. Tenant/contract configurations
-- remain able to override these effective values through versioned records.
UPDATE "rule_definitions"
SET
  "default_threshold_minutes" = 15,
  "enabled_by_default" = true,
  "updated_at" = CURRENT_TIMESTAMP
WHERE "code" = 'LOADING_DELAY';

UPDATE "rule_definitions"
SET
  "default_threshold_minutes" = 30,
  "enabled_by_default" = true,
  "updated_at" = CURRENT_TIMESTAMP
WHERE "code" = 'DEPARTURE_DELAY';

UPDATE "rule_definitions"
SET
  "default_threshold_minutes" = 15,
  "enabled_by_default" = true,
  "updated_at" = CURRENT_TIMESTAMP
WHERE "code" = 'STOP_ARRIVAL_DELAY';
