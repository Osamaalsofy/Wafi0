# Assumptions and pending clarifications

## Safe Phase 0 assumptions

- Node.js 20.19 or newer is the common runtime baseline required by the selected current toolchain.
- Local development uses PostgreSQL 17 in Docker and UTC at persistence boundaries.
- The API listens on port 3001 and the web application on port 3000 by default.
- The health endpoint reports process health only. Database readiness can be added when Prisma is first used by an implemented module.
- Redis, queues, and object storage are deferred because Phase 0 has no workload needing them.

These are technical defaults and do not define business behavior.

## Owner decisions needed before relevant implementation

- The authoritative tenant hierarchy: whether `Organization` is the platform tenant and `Client` is always subordinate, including cross-client WAFI roles.
- Final role names, permission catalog, and whether users may hold multiple roles across heterogeneous scopes.
- Final mission lifecycle and permitted transitions.
- Client-specific SLA values, severity levels, exception ownership, and blocking versus warning behavior.
- Required documents by mission/stop type and exact operational/accounting closure rules.
- Quantity units and conversion requirements by cargo/client.
- Monthly assignment behavior and its relationship to daily missions.
- Data residency, backup, recovery, retention, and deletion requirements.
- First external integration priorities and authentication/data contracts.
- Official reporting formats and localization terminology.

## Phase 1 provisional decision

`Organization` is currently the hard data-isolation boundary and `Client` will be subordinate master data. User role assignments carry an explicit scope type and scope identifier. Cross-organization platform access is not enabled until the owner confirms its governance model.

Driver license numbers and vehicle plate numbers are provisionally unique within their carrier. Vehicle capacity remains optional and is stored with an explicit, uninterpreted unit until supported units and conversion rules are approved.

## Phase 2 provisional decisions

- The project owner approved the proposed lifecycle on 10 August 2026. The centralized transition matrix is now enforced by the mission application service.
- New missions begin in `DRAFT`. Carrier, vehicle, and driver references remain nullable because assignment is a separate workflow in the specification.
- Mission creation requires an active client and an active warehouse belonging to that client. Stops require an active branch belonging to the same client.
- Mission and stop update DTOs deliberately exclude status and actual-operation timestamps. Those values will be changed only by dedicated transition, arrival, loading, and completion commands in later Phase 2 slices.
- Stop statuses are provisional technical vocabulary. Quantity values are persisted without unit conversion or derived shortage calculations until quantity-unit rules are approved.
- Mission events are append-only through the current API. The initial event catalog records factual CRUD actions only; it does not imply operational completion or SLA behavior.
- Assignment requires one active carrier plus an active vehicle and driver belonging to that carrier. Reassignment is currently allowed and audited; repeating the exact same assignment is idempotent. Assignment does not change mission status; the caller must request the explicit `ASSIGNED` transition.

### Approved lifecycle policy

The forward path is `DRAFT -> ASSIGNED -> WAITING_FOR_VEHICLE -> VEHICLE_ARRIVED -> LOADING -> LOADED -> DEPARTED -> IN_TRANSIT -> AT_STOP -> DELIVERING -> DELIVERED -> OPERATIONALLY_CLOSED -> ACCOUNTING_READY -> CLOSED`.

- `DELIVERING -> AT_STOP` is allowed for the approved stop-level operating loop.
- Cancellation is allowed from `DRAFT` through `DELIVERING`, requires a reason, and is terminal. Reopening is not supported.
- `ASSIGNED` requires carrier, vehicle, and driver references.
- `DELIVERED` requires at least one stop and all stops to be `COMPLETED`.
- `OPERATIONALLY_CLOSED` and `ACCOUNTING_READY` remain technically blocked until Phase 3 can enforce their required document and closure policies. This preserves the approved sequence without bypassing unimplemented requirements.

### Approved stop operation policy

- Stops progress through `PENDING -> ARRIVED -> UNLOADING -> COMPLETED` using dedicated commands.
- A stop may not arrive until every lower sequence on the same mission is `COMPLETED`.
- Repeating the command for the current target state is idempotent. Skips and backward transitions are rejected.
- Unloading start cannot precede actual arrival, and completion cannot precede unloading start.
- Received, rejected, and shortage quantities are accepted as explicit operational inputs. No equality, shortage derivation, or unit conversion is enforced until quantity rules are approved.

### Daily Loading read model

- Daily Loading is a read-only projection over missions whose `scheduledLoadingAt` falls within a caller-supplied `[from, to)` UTC window.
- The API reports exact counts by persisted mission status and exact stop progress. It does not reinterpret statuses into unapproved KPI or SLA categories.
- Daily Loading now reports the effective loading rule and persisted loading/data-quality exceptions. The rule-status anchor is actual loading time when available, otherwise scheduled loading time, otherwise the requested window start. It does not independently calculate delays or KPIs.

## Phase 3 provisional decisions

- A document always belongs to a mission and may additionally identify one stop from that same mission. This provides a single operational owner without a generic polymorphic foreign key.
- The initial accepted upload formats are PDF, JPEG, and PNG, with a configurable 10 MB default limit. Client-specific format and size policies remain undefined.
- `PENDING`, `VERIFIED`, and `REJECTED` describe technical verification state only. Re-verification is allowed and audited because final approval governance is not yet defined.
- Local files are stored below a configurable, ignored development directory through a storage interface. Authenticated content is currently streamed by the API. Production object storage, signed URLs, malware scanning, retention, and replacement rules remain pending.
- No document type is hardcoded as mandatory. Mission closure is unlocked only through an explicitly activated client policy whose actual requirements must be approved by the owner.
- Closure policies are client-scoped and separately configured for operational closure and accounting readiness. Missing active configuration blocks the transition; an explicitly activated empty policy authorizes a stage with no document requirements.
- Requirements use conjunctive evaluation and may target a mission or every stop. Active policies are immutable until deactivated. Effective dating, version history, and approval segregation remain undefined.

## Phase 4 provisional decisions

- The Control Tower technically defines active missions as all persisted mission statuses except `CLOSED` and `CANCELLED`.
- Status and stop summaries are exact counts of persisted states. They are not KPIs or inferred operational categories.
- Closure-document readiness is derived only from active, approved client policies. Page-level attention counts are explicitly labeled as page-scoped.
- Delay, SLA, exception severity, and carrier-performance evaluation remain unavailable until their formulas and thresholds are approved.
- The initial Control Tower browser session keeps tokens in memory and intentionally requires sign-in after a reload. Persistent refresh should use a server-managed secure cookie design rather than browser local storage.
- The mission detail drawer is read-only and uses independent 20-record pages for events and documents.
- Control Tower polling defaults to 60 seconds, can be disabled or changed to 30 seconds, and pauses while mission details are open. This is a provisional client-side operational default, not an SLA or business rule.

## Phase 5 approved decisions and provisional boundaries

- `LOADING_DELAY` uses the specification's 30-minute example as a configurable product default. An effective-dated organization, client, warehouse, or carrier configuration can override or disable it. Contract and route remain reserved scope vocabulary but cannot be configured until their approved tenant-owned domain models exist. The condition is strictly `actual - scheduled > threshold`; equality is not delayed.
- `DEPARTURE_DELAY` and `STOP_ARRIVAL_DELAY` use the same evaluator but remain disabled until a scoped threshold is configured. No threshold was inferred.
- `SHORTAGE` and `REJECTION` evaluate persisted quantities. The product default tolerance is zero because the owner explicitly approved opening the corresponding exception for a persisted quantity greater than zero. Scoped configurations can set a non-negative tolerance.
- Missing schedule or actual timestamps do not produce a delay value. They produce `MISSING_OPERATIONAL_DATA` when that data-quality rule is enabled.
- Severity is optional and configurable with `INFO`, `WARNING`, `HIGH`, and `CRITICAL`. No severity-to-threshold policy is implied.
- Exceptions are non-blocking by default. A versioned scoped configuration must explicitly make one blocking.
- Assignment is optional and reassignable. It can name a tenant user and preserve a responsibility scope snapshot; every change is audited.
- The minimal implemented exception lifecycle is `OPEN -> RESOLVED`; a later qualifying operational occurrence creates a new exception and audits it as reopened. Extra workflow states were not invented.
- Active deduplication uses organization, mission, optional stop, and rule code. Re-evaluation updates the active exception instead of creating another record.
- Rule selection is effective-dated and evaluation is event-driven. Creating a new version does not backfill old events. Any future backfill must be explicitly initiated and preserve the configuration version used.
- Rule and KPI version creation performs overlap detection, version allocation, persistence, and audit in one serializable transaction. Version audit snapshots include the complete stored operational configuration, not only scope metadata.
- Manual reevaluation is an explicit bounded command, not an automatic backfill. Its caller supplies the evaluation timestamp. It skips future-not-due operations and uses stable operational occurrence identifiers so rerunning the command does not manufacture a new occurrence.
- Timestamps are persisted as PostgreSQL `TIMESTAMPTZ` values. IANA time-zone identifiers and working-calendar JSON are configuration fields. UTC elapsed duration is timezone invariant; localized presentation can use the stored IANA identifier.
- Receiver signature and receiver stamp are supported evidence types. Operational and accounting closure remain separately enforced by effective client closure policies; no document becomes mandatory without such a policy.

### Phase 5 unresolved business decisions

- The exact working-calendar schema and elapsed-time semantics for holidays, shutdowns, shifts, and breaks. Until approved, configured calendar metadata is preserved but raw UTC elapsed time remains the evaluator basis.
- Contract and route master-data models and how missions reference them. The scope vocabulary supports both, but current event evaluation can only select organization, client, warehouse, and carrier scopes from persisted mission relations.
- Quantity units, conversions, precision/rounding policy, derived quantity equations, and percentage tolerances.
- Root-cause taxonomy, confirmation governance, decision approval rules, action priorities, escalation and notification delivery channels.
- Exact KPI contracts, eligibility, targets, aggregation periods, rounding, recalculation and carrier composite weights. No KPI value is calculated until approved.
- Candidate KPI definitions and versioned contract storage now exist, but `calculationAvailable` remains false. A stored/enabled contract is not a calculated or published KPI.
- Whether any configured blocking exception prevents a particular mission transition; the flag is persisted, but no transition is blocked until a transition-specific policy is approved.

The detailed decision register is maintained in `docs/phase-5-operational-intelligence-decision-pack.md`.
