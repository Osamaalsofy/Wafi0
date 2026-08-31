# Phase 5 operational-intelligence foundation

## Implemented flow

The first executable slice follows the documented chain without introducing a generic rules engine:

`Mission/stop data -> MissionEvent -> effective RuleConfiguration -> OperationalException -> RootCause -> Decision -> CorrectiveAction -> AuditLog`

Each qualifying exception also creates an in-app `Alert`. Control Tower returns open/critical counts and each mission's active exception summary. KPI and Decision Intelligence can consume the persisted, version-linked exception facts, but no unapproved KPI formula is calculated.

Daily Loading exposes the effective `LOADING_DELAY` rule status per mission, anchored to actual loading time when present, otherwise scheduled loading time, otherwise the requested window start. It also returns persisted open loading-delay and missing-operational-data conditions. This projection never recomputes delay facts or treats exception counts as a KPI.

Bounded manual reevaluation accepts an explicit evaluation timestamp plus either one mission or a schedule window, capped at 500 missions. It evaluates loading, departure, and stop-arrival time rules only when an actual timestamp exists or the scheduled timestamp is due. Future operations and records with neither timestamp are skipped. Each reviewed mission receives a factual reevaluation event and audit record; stable source-occurrence identifiers preserve exception idempotency across repeated commands.

The web Control Tower includes an authenticated exception workspace. Users can filter open/resolved exceptions, inspect persisted rule facts, and perform only the workflow operations authorized by the corresponding backend permission. The UI does not calculate delay, severity, ownership, or blocking behavior independently.

An authenticated rule-governance workspace lists immutable version history and creates organization, client, warehouse, or carrier configurations. Scope and owner choices come from a tenant-filtered backend options endpoint rather than request-supplied cross-tenant data. Unsupported contract and route scopes remain visible as a documented boundary but cannot be selected.

The Alerts workspace exposes paginated tenant in-app alerts, unread filtering, direct exception navigation, and an audited read action. It does not imply that email, SMS, retry, or escalation policies exist.

The KPI Registry stores immutable, effective-dated tenant contract versions for candidate KPIs from the specification. Formula, eligibility, data sources, period, targets, rounding, frequency, timezone, and scope remain explicit JSON/scalar configuration rather than executable assumptions. The options API reports `calculationAvailable: false`, and no KPI value or historical backfill table exists.

Contextual audit timelines are available for exceptions, rule configuration versions, and KPI configuration versions. Exception timelines include direct exception records plus related workflow records whose immutable audit payload carries the exception identifier. Audit access remains independently protected by `audit.read`.

## Rule resolution

Rule definitions provide safe product defaults. Immutable configurations override them for a bounded effective period and a tenant-owned scope. Overlap detection, version allocation, storage, and the full configuration audit snapshot are committed in one serializable transaction. Resolution filters by the event occurrence timestamp, then orders matches by explicit priority and scope specificity. Current mission facts resolve organization, client, warehouse, and carrier scopes.

- `LOADING_DELAY`: enabled, configurable default 30 minutes
- `DEPARTURE_DELAY`: disabled until a threshold configuration exists
- `STOP_ARRIVAL_DELAY`: disabled until a threshold configuration exists
- `SHORTAGE`: enabled, configurable default tolerance zero
- `REJECTION`: enabled, configurable default tolerance zero
- `MISSING_OPERATIONAL_DATA`: enabled data-quality condition

Configuration stores optional severity, blocking flag, user owner, responsibility scope, IANA time zone, calendar metadata, and `effectiveFrom`/`effectiveTo`. Event evaluation never rewrites or backfills historical events when a new version is created.

## Exception facts and traceability

An exception snapshots mission, client, warehouse, carrier, vehicle, driver, optional stop, affected stops, schedule/actual timestamps, delay or quantity facts, tolerance, selected rule version, ownership, severity, and blocking configuration. Supporting mission documents can be linked without copying file content.

The active deduplication key is tenant + mission + optional stop + rule code. Repeated evaluation updates an active exception. Resolution releases that key. Replaying the same resolved event does not reopen it; a later qualifying event creates a new record and audits `exception.reopened`.

All writes are tenant-scoped and backend permission-protected. Rule-version creation, exception open/update/reopen, assignment, severity, resolution, evidence, root cause, decision, and action changes produce audit records.

## Closure and evidence

`RECEIVER_SIGNATURE` and `RECEIVER_STAMP` join Waybill, Gate Pass, POD, shortage proof, and return proof as reusable document types. They become required only through an effective client closure policy. Operational Closure and Accounting Ready remain separate lifecycle gates.

## Known boundaries

- Working-calendar JSON is retained, but its structure and excluded-time calculation remain pending owner approval. Current elapsed duration is raw UTC duration.
- Contract and route are reserved configuration scope vocabulary, but creation is rejected while mission references and tenant-owned master-data validation are pending their domain models.
- Root-cause taxonomy and decision/action governance remain free-form/minimal pending approval.
- No periodic reevaluation queue, external notification transport, KPI aggregation, or retroactive backfill is implemented.
