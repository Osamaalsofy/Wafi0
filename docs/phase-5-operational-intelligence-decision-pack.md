# Phase 5 operational-intelligence decision pack

> **Decision status update (2026-08-13):** the pending product decisions in this planning document are resolved by [production-business-decisions-v1.md](./production-business-decisions-v1.md), approved as version 1.0. This file remains historical design context; the approved version-1 thresholds, KPI formulas, closure rules, and release gates are authoritative in the newer package.

This document records the approved first Phase 5 rule slice and separates it from definitions that still require owner approval. Approved rules are executable only for the facts and scope-resolution paths described below; KPI formulas remain gated.

## Confirmed scope from the technical specification

The first operational-intelligence release should use explicit, traceable rules rather than AI. A meaningful operational event may be evaluated by a rule, produce an exception, receive a root cause, lead to a decision and action, and leave an audit trail.

The specification identifies these candidate exceptions:

| Candidate code       | Source signal                                                        | Candidate result                 | Approval status                           |
| -------------------- | -------------------------------------------------------------------- | -------------------------------- | ----------------------------------------- |
| `LOADING_DELAY`      | Actual loading compared with scheduled loading and allowed delay     | Open loading-delay exception     | Approved: configurable default 30 minutes |
| `DEPARTURE_DELAY`    | Actual departure compared with scheduled departure and allowed delay | Open departure-delay exception   | Architecture approved; threshold required |
| `STOP_ARRIVAL_DELAY` | Actual stop arrival compared with expected arrival and tolerance     | Open stop-delay exception        | Architecture approved; threshold required |
| `SHORTAGE`           | Persisted shortage quantity greater than configured tolerance        | Open shortage exception          | Approved: configurable default zero       |
| `REJECTION`          | Persisted rejected quantity greater than configured tolerance        | Open rejection exception         | Approved: configurable default zero       |
| `MISSING_POD`        | Delivery completed and required POD absent beyond its SLA            | Open missing-POD exception       | Pending                                   |
| `DOCUMENT_REJECTED`  | Required document rejected                                           | Prevent closure until remediated | Pending                                   |

The specification identifies these candidate KPIs:

| Candidate KPI             | Provisional numerator / denominator                     | Approval status |
| ------------------------- | ------------------------------------------------------- | --------------- |
| On-Time Vehicle Arrival % | On-time vehicle arrivals / eligible vehicle arrivals    | Pending         |
| On-Time Loading %         | On-time loaded missions / eligible loaded missions      | Pending         |
| On-Time Departure %       | On-time departures / eligible departures                | Pending         |
| On-Time Delivery %        | On-time completed stops / eligible completed stops      | Pending         |
| POD Completion %          | Valid POD records / required POD records                | Pending         |
| Shortage Rate             | Shortage quantity / expected quantity                   | Pending         |
| Exception Rate            | Missions with qualifying exceptions / eligible missions | Pending         |
| Carrier Service Level     | Composite formula not defined                           | Pending         |

These expressions are candidate definitions only. Terms such as “eligible,” “on-time,” “valid,” and “qualifying” must be defined before implementation.

## Approved common rule behavior

- Configurations are tenant-isolated, scoped, versioned, and effective-dated.
- Supported scope vocabulary is organization, client, warehouse, carrier, contract, and route. Mission evaluation currently has persisted selectors for the first four; contract and route mission references remain pending.
- Missing timestamps create a missing-operational-data condition and never a fabricated delay or KPI value.
- Severity, owner/responsibility, blocking behavior, threshold, time zone, and calendar metadata are configuration, not client-specific code.
- Active exceptions deduplicate by mission, optional stop, and rule. Resolution clears the active key; only a later qualifying event reopens the condition as a new auditable record.
- Rule configuration creation, exception open/update/reopen/resolution, severity and owner changes, root cause, decision, corrective action, and evidence attachment are audited.

## Decisions still required for time-based rules

The owner must approve all fields below independently for each client and, where necessary, warehouse, branch, carrier, cargo type, or route.

1. Effective date and optional expiry date.
2. Operating time zone used to interpret schedules.
3. Threshold or tolerance in minutes, except the approved configurable 30-minute default for `LOADING_DELAY`.
4. Whether early arrivals count as compliant, non-compliant, or informational.
5. Calendar treatment for weekends, public holidays, shutdowns, and warehouse operating hours.
6. Any refinement beyond the approved missing-operational-data condition.
7. Rescheduling policy and which schedule version is authoritative.
8. Evaluation timing: event-driven, periodic, or both.
9. Severity assignment and whether severity changes as elapsed time increases.
10. Default owner and fallback owner.
11. Any exception-type-specific deduplication requirement beyond the approved common key.
12. Transition-specific blocking policy; the approved default is warning/non-blocking.

## Decisions required for quantity and document rules

### Shortage and rejection

- Approved quantity units and any conversion rules.
- Whether shortage remains explicit input or is derived from expected, received, and rejected quantities.
- Decimal precision and rounding policy.
- Zero and negative-value handling.
- Threshold: any positive amount or client-specific absolute/percentage tolerance.
- Required proof documents and approval roles.
- Whether one exception is opened per mission, stop, product line, or occurrence.

### Missing or rejected documents

- Required document types by client, mission type, stop, cargo, and closure stage.
- SLA anchor event and elapsed-time definition.
- Whether `PENDING` verification is considered missing, incomplete, or valid.
- Replacement/versioning rules after rejection.
- Who may waive a requirement and how that waiver is audited.
- Which document failures block operational closure or accounting readiness.

## Exception lifecycle decisions

The minimal implemented lifecycle is `OPEN -> RESOLVED`, with a new qualifying occurrence recorded and audited as a reopen. The owner must still define whether more workflow is required:

- Status vocabulary and transition matrix.
- Severity vocabulary and escalation thresholds.
- Assignment scope: user, role, team, carrier, warehouse, or client.
- Acknowledgement and resolution SLAs.
- Resolution evidence requirements.
- Reopen, duplicate, merge, cancel, and false-positive behavior.
- Whether root-cause confirmation is mandatory before resolution.
- Whether a decision and action are mandatory for selected severities.
- Notification channels and retry/escalation policy.

The approved severity vocabulary is `INFO`, `WARNING`, `HIGH`, and `CRITICAL`; assignment remains optional until configured.

## Root-cause taxonomy decisions

Root cause must be structured enough for reporting while preserving a narrative explanation. Approval is required for:

- Category hierarchy and client-specific extensions.
- Single versus multiple causes per exception.
- Primary/contributing cause distinction.
- Confirmation roles and segregation of duties.
- Mandatory evidence and notes.
- Whether taxonomy entries may be retired without changing historical records.

Suggested governance, not a business definition: use versioned, data-driven taxonomy records rather than hardcoded strings.

## Decision and action governance

The owner must define:

- Who can create, approve, amend, and cancel decisions.
- Whether multiple decisions may be active for one exception.
- Action status model, priority, due-date rules, and completion evidence.
- Whether overdue actions create a new exception or escalation.
- Delegation and reassignment behavior.
- Closure dependencies between exception, decision, and actions.
- Audit and retention requirements.

## KPI definition contract

Every KPI must be approved with this complete contract:

| Field                 | Required definition                                                       |
| --------------------- | ------------------------------------------------------------------------- |
| Code and display name | Stable identifier plus approved Arabic and English labels                 |
| Business purpose      | Decision the KPI is intended to support                                   |
| Formula               | Exact numerator, denominator, operators, precision, and rounding          |
| Eligibility           | Included and excluded missions, stops, statuses, cancellations, and tests |
| Time basis            | Event timestamp, operating time zone, calendar, and schedule version      |
| Scope                 | Organization, client, carrier, warehouse, branch, route, or cargo         |
| Period                | Daily, weekly, monthly, rolling, or custom boundaries                     |
| Threshold and target  | Target, warning, and critical values                                      |
| Data quality          | Missing, late, corrected, duplicated, and invalid input treatment         |
| Recalculation         | Trigger, frequency, backfill window, and correction policy                |
| Drill-down            | Source records that must explain the aggregate                            |
| Ownership             | Business owner who approves and periodically reviews the definition       |

### KPI-specific open questions

- Is on-time delivery evaluated per stop, per mission, or both?
- Does a mission pass only when every required stop passes?
- Are cancelled missions excluded from every denominator?
- Does POD completion require upload, verification, or both?
- Is shortage rate quantity-weighted, stop-weighted, or mission-weighted?
- Does exception rate count missions, exception instances, or severity-weighted exceptions?
- Which approved components and weights form Carrier Service Level?

## Safe technical architecture after approval

The following is an engineering proposal and does not define business behavior:

- Store rule and KPI definitions as versioned, tenant/client-scoped configuration with effective dates.
- Keep factual mission events append-only and separate from derived exceptions and KPI values.
- Evaluate approved rules in application services first; defer a generic rules engine until configuration needs justify it.
- Persist the definition version and input facts used for each evaluation so results are reproducible.
- Use deterministic idempotency keys to prevent duplicate exceptions from repeated events or jobs.
- Preserve historical exception, taxonomy, KPI, decision, and action records when definitions are retired.
- Centralize audit emission in application services or domain events rather than controllers.
- Defer Redis and BullMQ until periodic evaluation, notifications, or recalculation creates an immediate queue requirement.

## Data-readiness findings

Current persisted fields support factual inputs for scheduled/actual loading, scheduled/actual departure, expected/actual stop arrival, explicit shortage and rejection quantities, document verification, mission events, and audit logs.

Implementation remains intentionally limited where the required source fact or meaning is absent:

- Vehicle-arrival time is represented indirectly by mission status/event history, not a dedicated approved timestamp contract.
- Schedule revisions and authoritative schedule version are not modeled.
- Operating calendar metadata, IANA time zones, and thresholds are modeled; calendar interpretation still needs an approved schema.
- Quantity unit is not stored on mission-stop quantities.
- Root-cause taxonomy and escalation governance are not approved.
- KPI definition versioning and recalculation policy are not approved.

## Owner approval worksheet

For each proposed rule or KPI, return:

```text
Code:
Enabled for:
Effective from:
Time zone:
Formula or condition:
Threshold/tolerance:
Calendar behavior:
Eligibility/exclusions:
Missing-data behavior:
Severity/targets:
Owner:
Blocking behavior:
Evaluation frequency:
Reopen/deduplication behavior:
Arabic label:
English label:
Approver and approval date:
```

## Remaining implementation gate

No KPI values, contractual severity escalation, working-calendar exclusions, percentage tolerances, transition blocking, or composite carrier score may be implemented until its complete business contract is approved. The rule/exception workflow can continue independently without inventing those definitions.
