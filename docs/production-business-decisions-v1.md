# WAFI OS production business decisions — version 1.0

## Approval record

| Field | Approved value |
| --- | --- |
| Status | **APPROVED FOR IMPLEMENTATION** |
| Decision version | `1.0` |
| Approval date | `2026-08-13` |
| Default effective date | `2026-09-01T00:00:00Z` |
| Authority | Project-owner delegation recorded in the project task |
| Applies to | The production-readiness baseline for WAFI OS |

This package closes the open product-policy questions for the first production release. It does not claim that every approved rule is already implemented. Each item is labelled **Release 1**, **gated**, or **later** so that product approval is not confused with technical completion.

`README.md` remains the authoritative delivery roadmap. This document is the authoritative version-1 business-rule package. A conflicting operational rule must be handled by a new effective-dated version; historical records and KPI snapshots must never be rewritten to imitate the new rule.

## 1. Governance and scope

1. `Organization` is the hard tenant and security boundary. Data must never cross organizations.
2. `Client` is subordinate to an organization and does not constitute a separate tenant.
3. Configuration is effective-dated, versioned, auditable, and immutable after use. A correction creates a new version.
4. For mission rule resolution, higher numeric priority wins. At equal priority, specificity is:
   `CONTRACT > WAREHOUSE > CARRIER > CLIENT > ORGANIZATION`.
5. Route and driver scopes may be used for KPI configuration and administration. They are not treated as mission-rule overrides until the evaluator supports them end to end.
6. Production defaults are organization-scoped. A client, carrier, warehouse, or contract override is permitted only when it has an owner, reason, effective date, and audit record.
7. All persisted instants use UTC. Route-local time is used for display, schedule interpretation, and KPI period boundaries.

## 2. Operational calendar and schedule authority

| Decision | Approved policy | Delivery state |
| --- | --- | --- |
| Base calendar | Continuous `24/7`, all seven days | Release 1 |
| Weekends/holidays | SLA clocks do not pause | Release 1 |
| Route time zone | Required IANA time-zone identifier | Release 1 |
| Missing route time zone | Organization default; bootstrap default `Asia/Muscat` | Release 1 configuration |
| Schedule authority | Latest valid schedule persisted before the actual event or KPI cutoff | Release 1 |
| Schedule correction | Must be audited; never overwrite a closed KPI snapshot | Release 1 |
| Advanced shifts/holiday calendars | Client-specific, effective-dated calendar | Later |

An actual event exactly on its due time plus tolerance is compliant. An early event is compliant and does not create a negative delay. If a required scheduled or actual timestamp is absent, the platform records `MISSING_OPERATIONAL_DATA`; it must not invent a time, infer punctuality, or silently count the record as late.

## 3. Approved operational rules

| Rule | Organization default | Severity | Blocking | Owner fallback | State |
| --- | ---: | --- | --- | --- | --- |
| `LOADING_DELAY` | More than 30 minutes after scheduled loading | `WARNING` | No | Warehouse operations manager | Release 1 |
| `DEPARTURE_DELAY` | More than 30 minutes after scheduled departure | `WARNING` | No | Dispatcher | Release 1 |
| `STOP_ARRIVAL_DELAY` | More than 15 minutes after expected stop arrival | `WARNING` | No | Dispatcher | Release 1 |
| `SHORTAGE` | Explicit shortage quantity greater than `0.000` | `HIGH` | No | Operations manager | Release 1 |
| `REJECTION` | Explicit rejected quantity greater than `0.000` | `HIGH` | No | Operations manager | Release 1 |
| `MISSING_OPERATIONAL_DATA` | Required fact absent at evaluation time | `WARNING` | No | Data owner for the fact | Release 1 |
| `ROUTE_DEVIATION` | No default threshold until a trusted location source is connected | `HIGH` | No | Fleet manager | Gated |
| `MISSING_POD` | Required POD not verified within 24 hours of stop completion | `HIGH` | Closure only | Document verifier | Gated |
| `DOCUMENT_REJECTED` | Required document is rejected | `HIGH` | Closure only | Document verifier | Gated |

“Closure only” means the condition blocks the relevant operational-closure or accounting-readiness decision; it does not block mission telemetry or the lawful recording of actual events.

Evaluation is event-driven after the relevant mission change. A periodic sweep every 15 minutes is also required in production for due events that have not arrived. Until that worker exists, bounded manual re-evaluation remains an accepted operational fallback and must be audited.

Active exceptions deduplicate by organization, rule, mission, and optional stop. Repeated detection updates the existing open exception. A condition detected again after resolution opens a new auditable occurrence.

## 4. Quantity policy

1. Persisted `shortageQuantity` and `rejectedQuantity` are authoritative explicit operational inputs; version 1 performs no derivation or unit conversion.
2. Values are non-negative and use three decimal places. Negative values are invalid.
3. Expected, shortage, and rejected quantities within one stop must use the same business unit. Because the current schema does not persist a unit, integrations must send only already-normalized values.
4. A positive quantity opens one exception per mission stop and rule.
5. Percentage KPIs include only stops with expected quantity greater than zero and a confirmed common unit. Exclusions are counted and reported as data-quality exclusions.
6. A client-specific non-zero tolerance requires a versioned configuration. The organization default remains zero tolerance.
7. Proof is mandatory before resolving a shortage or rejection exception: a verified POD, discrepancy note, or return document, plus a root cause.

Multi-unit conversion, product-line exceptions, and automatic reconciliation are **later** capabilities and must not be simulated with hidden assumptions.

## 5. Document and closure policy

### Operational closure

- Every completed delivery stop requires one `VERIFIED` POD.
- `PENDING` and `REJECTED` documents do not satisfy a requirement.
- A shortage or rejection also requires verified discrepancy evidence before its exception can be resolved.
- Receiver signature and stamp are optional at organization level and may be required by an effective-dated client policy.

### Accounting readiness

- All operational-closure requirements must be satisfied.
- One verified mission-level waybill is required.
- A client may add, but not silently remove, invoice-supporting requirements through a versioned closure policy.

### Verification and storage controls

1. The uploader may not verify their own production document. `ORGANIZATION_ADMIN` may perform an emergency override only with a reason and audit event.
2. Rejection requires a note. Replacement creates a new document/version; it does not overwrite the rejected artifact.
3. Accepted release-1 formats are PDF, JPEG, and PNG, with a maximum size of 10 MiB per file.
4. Production files are private, encrypted, malware-scanned, and served only with short-lived authorized access.
5. Document metadata, verification history, and files are retained for seven years. Ordinary roles cannot permanently delete them; legal hold prevents expiry.
6. These controls are **gated** until production object storage and malware scanning are configured. Local filesystem storage is not production-approved.

## 6. Exception handling and responsibility

The release-1 technical state remains `OPEN -> RESOLVED`. Acknowledgement and SLA are operational metadata until dedicated workflow fields are added.

| Severity | Acknowledge target | Resolution target | Escalation target |
| --- | ---: | ---: | --- |
| `CRITICAL` | 15 minutes | 4 hours | Organization administrator + operations manager |
| `HIGH` | 30 minutes | 8 hours | Operations manager |
| `WARNING` | 4 hours | 48 elapsed hours | Functional manager |
| `INFO` | 24 hours | 5 elapsed days | Functional manager |

Resolution requires a resolution note. A root cause is mandatory for `HIGH` and `CRITICAL`, and for every shortage, rejection, missing-POD, or rejected-document exception. `CRITICAL` resolution additionally requires a recorded decision and at least one completed or explicitly waived corrective action.

Approved primary root-cause families are:

- `OPERATIONS`, `WAREHOUSE`, `CARRIER`, `DRIVER`, `VEHICLE`
- `CLIENT`, `ROUTE`, `DOCUMENT`, `SYSTEM`, `EXTERNAL`
- `FORCE_MAJEURE`, `OTHER`

Exactly one primary family is required when root cause is mandatory. Additional contributing causes are allowed. `OTHER` requires an explanatory note. Taxonomy changes are additive and versioned; historical labels are not renamed in place.

## 7. Alert policy

1. In-app alerting is the mandatory baseline for all severities.
2. Email is sent for `HIGH` and `CRITICAL`; `WARNING` and `INFO` remain in-app unless a scoped policy says otherwise.
3. Delivery permits two attempts: the initial attempt and one retry after five minutes. A second failure marks delivery failed and escalates to the fallback owner.
4. A still-open `CRITICAL` exception escalates after 15 minutes; `HIGH` escalates after 60 minutes.
5. Alert payloads contain identifiers and a secure application link, not document attachments or sensitive free text.
6. SMS and WhatsApp are not approved for release 1.

Real email delivery and periodic escalation are **gated** until the external provider, worker, monitoring, and retry dead-letter handling are production-ready.

## 8. KPI definitions

### Common calculation rules

1. KPI facts come from immutable daily snapshots using the effective configuration and source cutoff recorded with the snapshot.
2. Default period is a route-local calendar day; management reporting aggregates daily facts into route-local calendar months.
3. Cancelled missions are excluded. A record missing a required fact is excluded from the numerator and denominator and counted separately as a data-quality exclusion.
4. Percentages use `numerator / denominator * 100`, round half up to two decimals, and return `N/A` when the denominator is zero.
5. Targets apply at organization level unless a more specific effective-dated KPI configuration exists.

| KPI code | Approved formula | Target | State |
| --- | --- | ---: | --- |
| `ON_TIME_LOADING` | Eligible missions with `actualLoadingAt <= scheduledLoadingAt + 30m` / eligible loaded missions | `>= 95%` | Release 1 |
| `ON_TIME_DEPARTURE` | Eligible missions with `actualDepartureAt <= scheduledDepartureAt + 30m` / eligible departed missions | `>= 95%` | Release 1 |
| `ON_TIME_DELIVERY` | Eligible completed stops with actual arrival `<= expectedArrivalAt + 15m` / eligible completed stops | `>= 95%` | Release 1 |
| `POD_COMPLETION` | Required POD obligations satisfied by a verified POD / all due POD obligations | `>= 98%` | Gated |
| `SHORTAGE_RATE` | Sum explicit shortage quantity / sum expected quantity for unit-compatible eligible stops | `<= 0.50%` | Release 1 |
| `EXCEPTION_RATE` | Distinct eligible missions with at least one `WARNING`, `HIGH`, or `CRITICAL` operational exception / eligible missions | `<= 5%` | Release 1 |
| `ON_TIME_VEHICLE_ARRIVAL` | Vehicle-arrived event at or before scheduled loading time / eligible arrivals | `>= 95%` | Gated |
| `CARRIER_SERVICE_LEVEL` | Weighted composite defined below | `>= 90%` | Gated until all components are reliable |

For version 1, “on-time delivery” measures arrival at the delivery stop because no approved planned-completion timestamp exists. The label and formula must be shown together in reports to prevent misinterpretation.

`ON_TIME_VEHICLE_ARRIVAL` remains disabled until a dedicated, immutable vehicle-arrival timestamp is persisted. Event-history inference may be used for backfill validation, not as an invisible production assumption.

### Carrier service-level score

The score is bounded to `0..100`:

```text
0.25 × On-Time Departure
+ 0.35 × On-Time Delivery
+ 0.20 × POD Completion
+ 0.10 × max(0, 100 − Shortage Rate)
+ 0.10 × max(0, 100 − Exception Rate)
```

The score is published only when all five components have a non-zero denominator and at least 20 eligible missions in the period. Otherwise it is `N/A`, not zero.

## 9. KPI recalculation, review, and publication

1. Daily snapshots are generated after the route-local day closes and are idempotent.
2. The current open month may be recalculated nightly from new immutable snapshots. A prior snapshot is retained rather than edited.
3. Monthly results freeze at the end of day 3 after month-end and publish on day 4 after KPI-owner review.
4. Authorized backfill is limited to 90 days per request, requires `kpi.snapshot`, a reason, and an audit event. Longer backfill requires organization-administrator approval and a controlled job.
5. A late correction after publication creates a visibly revised publication version; it never silently replaces the published number.

## 10. Roles and segregation of duties

| Responsibility | Default role/persona |
| --- | --- |
| Tenant configuration, emergency override, role assignment | Organization Administrator |
| Mission execution and dispatch exceptions | Dispatcher / Operations Manager |
| Vehicle and driver exceptions | Fleet Manager |
| Document verification | Document Verifier |
| KPI configuration, snapshot, review, publication | KPI Analyst / Operations Manager |
| Root-cause quality and corrective actions | Quality Manager |
| Read-only oversight | Auditor |

`ORGANIZATION_ADMIN` is a tenant administrator, not a platform super-admin. It may administer only its organization. Routine users receive the least permissions needed; document upload and verification are separated; KPI preparation and publication should be separated where staffing permits.

## 11. Production integrations and non-functional decisions

1. Object storage must be S3-compatible, private, encrypted at rest, versioned, and deployed in an approved GCC region where available.
2. Email uses a transactional provider through an adapter; provider credentials never enter source control.
3. Background evaluation, KPI generation, alerts, and document scanning use a durable queue with retry and dead-letter monitoring.
4. External weather, traffic, accident, and temperature data remain optional and unavailable by default. Their absence must be explicit in KPI facts and must not fabricate a score.
5. Production targets are RPO 15 minutes and RTO 4 hours. Database point-in-time recovery is retained for 35 days; restore tests run quarterly.
6. Application/audit data needed for legal or contractual evidence is retained for seven years. Operational logs are retained 90 days online and one year archived, with secrets and document contents redacted.

No particular cloud vendor is a business requirement. A deployment may select a compliant provider without changing these product rules.

## 12. Release gates

### Approved for implementation now

- The six implemented operational rules and their defaults.
- Continuous 24/7 calendar and UTC/route-local handling.
- Quantity policy, exception ownership, root-cause policy, and two-attempt alert contract.
- Daily immutable KPI snapshots and the five KPIs marked Release 1.
- Tenant isolation, versioning, audit, and scoped overrides.

### Must be complete before production go-live

- Production object storage, malware scanning, backup/restore proof, and transactional email.
- Durable periodic workers for overdue-event evaluation, alerts, and KPI generation.
- Browser E2E coverage of sign-in, roles, mission lifecycle, closure, exceptions, and KPI publication.
- Full Arabic/English structural localization, including validation and error messages.
- Monitoring, dead-letter handling, and an operator runbook.

### Explicitly gated

- Vehicle-arrival KPI until its dedicated timestamp is persisted.
- POD and document rules/KPI until production storage and verification controls are active.
- Route deviation until a trusted location integration and an approved distance/time threshold exist.
- Carrier composite until every component passes data-quality and minimum-volume gates.

## 13. Change control

This package is approved as version `1.0`. Implementation may add technical detail but may not change thresholds, eligibility, targets, ownership, closure semantics, or retention without a recorded decision version. Any exception must identify its organization, scope, owner, reason, effective date, and expiry or review date.

