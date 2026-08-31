# Phase 5 acceptance coverage

The database-backed Phase 5 suite is located at `apps/api/test/operational-intelligence.integration-spec.ts`. It uses the same hard guard as the existing integration suite: `DATABASE_URL` must name a database ending in `_test`.

HTTP authorization coverage is located at `apps/api/test/operational-intelligence.e2e-spec.ts` and uses the same database-name guard.

## Covered behavior

- Effective client rule configuration overrides the configurable product default at the event occurrence timestamp.
- Repeated qualifying evaluations update one active exception instead of creating duplicates.
- Replaying the occurrence that produced a resolved exception does not reopen it.
- A later qualifying event creates a new exception and audits `exception.reopened`.
- Exception lists and alert state are isolated by authenticated organization.
- Alert read state is persisted and audited.
- Overlapping effective periods for the same rule/KPI and scope are rejected.
- Rule/KPI overlap detection and version allocation execute atomically at serializable isolation.
- Adjacent KPI versions remain immutable and increment their version number.
- Cross-tenant KPI scope references are rejected.
- Contract and route rule/KPI scopes are rejected until tenant-owned domain models can validate those references.
- KPI registry writes create audit records without calculating KPI values.
- Rule and KPI version audit records snapshot all persisted configuration fields needed to reconstruct the version decision.
- Phase 5 read endpoints reject unauthenticated requests.
- Read-only roles can inspect rules, exceptions, alerts, and KPI contracts but cannot mutate them or read audit context without `audit.read`.
- Rule/KPI management, exception severity, root cause, decision, action, alert-read, and audit-context endpoints enforce their distinct permissions.
- Invalid DTO values and cross-tenant scope references are rejected over HTTP.
- Root cause, decision, action creation/completion, and severity changes appear in the consolidated exception audit timeline.

The pre-existing tenant integration cleanup now removes Phase 5 dependent records before missions, users, and organizations, preserving foreign-key correctness when operational rules generate exceptions during older acceptance paths.

## Execution

Apply all migrations to an isolated PostgreSQL test database, then run:

```bash
DATABASE_URL=postgresql://.../wafi_os_test pnpm --filter @wafi/api test:integration
DATABASE_URL=postgresql://.../wafi_os_test pnpm --filter @wafi/api test:e2e
```

The suite was statically type-checked and linted in the current environment. Runtime database execution remains pending because Docker/PostgreSQL is unavailable here.
