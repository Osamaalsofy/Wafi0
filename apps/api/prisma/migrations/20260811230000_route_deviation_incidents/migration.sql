INSERT INTO "rule_definitions" (
  "code", "name", "description", "default_threshold_minutes",
  "default_quantity_tolerance", "enabled_by_default", "updated_at"
) VALUES (
  'ROUTE_DEVIATION',
  'Route deviation',
  'A driver has left the expected route for a mission.',
  NULL,
  NULL,
  true,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO NOTHING;
