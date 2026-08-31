# Phase 4 Control Tower foundation

The initial Control Tower is a tenant-scoped backend read model over persisted operational data.

The response includes active client, warehouse, and carrier filter metadata from the authenticated organization. Mission summary and rows accept validated `clientId`, `warehouseId`, and `carrierId` query filters; tenant scope is always derived from the authenticated principal.

## API

`GET /api/v1/control-tower` requires `control_tower.read` and supports pagination, search, and optional client, warehouse, carrier, or active-status filters.

## Returned information

- Active missions, defined technically as missions not in `CLOSED` or `CANCELLED`.
- Exact mission counts by persisted status.
- Client, warehouse, carrier, vehicle, and driver references.
- Exact stop counts by persisted stop status.
- Closure readiness for `DELIVERED` and `OPERATIONALLY_CLOSED` missions.
- Missing verified mission-level or per-stop documents derived from the active client closure policy.

`pageRequiringDocumentAttention` describes only the returned page and is named accordingly. It must not be interpreted as a tenant-wide KPI.

## Deliberate boundaries

Delay evaluation is explicitly unavailable. The read model does not label missions late, calculate service levels, infer exception severity, or produce carrier performance scores because SLA thresholds and KPI definitions remain unapproved.

No frontend dashboard is included in this backend foundation slice.
