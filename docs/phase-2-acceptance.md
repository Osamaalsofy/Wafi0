# Phase 2 Acceptance

## Accepted scope

The Mission Core acceptance scenario verifies the following against PostgreSQL:

1. Create a tenant-scoped draft mission.
2. Add a sequenced client branch stop.
3. Assign an active carrier, its vehicle, and its driver.
4. Transition through every approved state from `DRAFT` to `DELIVERING`.
5. Reject `DELIVERED` while a required stop remains incomplete.
6. Record stop arrival, unloading start, quantities, and completion.
7. Transition the mission to `DELIVERED`.
8. Reconstruct the append-only event timeline.
9. Confirm audit coverage and Daily Loading visibility.

## Safety boundaries

- `OPERATIONALLY_CLOSED` and `ACCOUNTING_READY` remain blocked until Phase 3 document policies exist.
- Mission status cannot be changed through generic update endpoints.
- Tenant identifiers are never accepted as authorization scope from API input.
- Delay and KPI calculations remain unavailable because SLA definitions are pending.

## Pending owner decisions

- Whether `actualLoadingAt` represents loading start or loading completion.
- Whether `actualDepartureAt` should be populated automatically by the `DEPARTED` transition.
- Quantity units, reconciliation formulas, and shortage derivation.
- Stop cancellation and reopening rules.
- Whether Monthly Assignments are required and how they relate to daily missions.
