# WAFI OS

WAFI OS is a multi-tenant logistics operations and operational-intelligence platform. The repository contains the platform foundation, identity/master data, Mission Core, documents and closure policies, Control Tower, and the first event-driven Phase 5 rules and exception workflow. KPI formulas and external integrations remain intentionally unimplemented until their contracts are approved.

Phase 1 has passed migrations, strict type checking, linting, unit tests, production builds, the health endpoint test, and database-backed tenant-isolation and relational-integrity tests.

## Prerequisites

- Node.js 20.19 or newer
- pnpm 11
- Docker Desktop or Docker Engine with Compose

## Local setup

1. Clone the repository and enter its root.
2. Create local configuration: `cp .env.example .env`.
3. Replace `POSTGRES_PASSWORD` in `.env` and update the password in `DATABASE_URL` to match.
4. Install dependencies: `pnpm install`.
5. Start PostgreSQL: `docker compose up -d postgres`.
6. Validate Prisma: `pnpm db:validate`.
7. Generate Prisma Client: `pnpm db:generate`.
8. When a migration exists, apply it locally with `pnpm db:migrate`; CI/production uses `pnpm db:deploy`.
9. Replace all `BOOTSTRAP_*` placeholders, then provision the first organization once with `pnpm bootstrap:identity`.
10. Remove the bootstrap password from `.env` after successful provisioning.
11. Start both applications: `pnpm dev`.

The web application is available at `http://localhost:3000`. The API health endpoint is `http://localhost:3001/api/v1/health`, and Swagger UI is `http://localhost:3001/api/docs`.

## Commands

- `pnpm build` — build all applications and packages
- `pnpm lint` — run all linters
- `pnpm typecheck` — run strict TypeScript checks
- `pnpm test` — run unit tests
- `pnpm --filter @wafi/api test:e2e` — run critical API tests
- `DATABASE_URL=postgresql://.../wafi_os_test pnpm --filter @wafi/api test:integration` — run database-backed tenant-isolation and relational-integrity tests; the database name must end in `_test`
- `pnpm format:check` — verify formatting
- `pnpm format` — apply formatting
- `pnpm db:validate` — validate the Prisma schema
- `pnpm db:generate` — generate Prisma Client
- `pnpm db:migrate -- --name <name>` — create/apply a local migration
- `pnpm db:deploy` — apply committed migrations non-interactively
- `pnpm bootstrap:identity` — explicitly provision the first organization administrator

## Environment variables

| Variable                 | Purpose                                      | Default in example             |
| ------------------------ | -------------------------------------------- | ------------------------------ |
| `NODE_ENV`               | API runtime mode                             | `development`                  |
| `API_PORT`               | API port                                     | `3001`                         |
| `WEB_PORT`               | Web port                                     | `3000`                         |
| `DATABASE_URL`           | PostgreSQL connection URL                    | local placeholder              |
| `CORS_ORIGINS`           | Comma-separated allowed web origins          | `http://localhost:3000`        |
| `NEXT_PUBLIC_API_URL`    | Browser-visible API base URL                 | `http://localhost:3001/api/v1` |
| `JWT_ACCESS_SECRET`      | Access-token signing secret (32+ characters) | placeholder only               |
| `JWT_ACCESS_TTL_SECONDS` | Access-token lifetime                        | `900`                          |
| `REFRESH_TOKEN_TTL_DAYS` | Refresh-session lifetime                     | `30`                           |
| `RATE_LIMIT_TTL_MS`      | Global rate-limit window                     | `60000`                        |
| `RATE_LIMIT_MAX`         | Requests permitted per global window         | `120`                          |

Never commit `.env` or real credentials.

API errors use a consistent JSON envelope containing `statusCode`, `code`, `message`, optional validation `details`, `requestId`, `timestamp`, and `path`. The same request identifier is returned in the `x-request-id` response header. Authentication endpoints have tighter in-memory rate limits; distributed rate-limit storage is deferred until horizontal deployment is introduced.

## Repository map

- `apps/web` — Next.js App Router frontend, strict TypeScript, ESLint, Vitest
- `apps/api` — NestJS API, environment validation, Swagger, health endpoint, Jest
- `apps/api/prisma` — PostgreSQL schema and migration history
- `packages/*` — intentionally small shared seams for UI, types, validation, and configuration
- `docs/architecture.md` — architecture assessment and target structure
- `docs/assumptions-and-clarifications.md` — technical defaults and unresolved owner decisions
- `docs/phase-2-acceptance.md` — verified Mission Core acceptance path and remaining decisions
- `docs/phase-3-documents.md` — document storage, metadata, verification, and current boundaries
- `docs/phase-3-closure-policies.md` — client-scoped document requirements for mission closure
- `docs/phase-3-acceptance.md` — verified document, closure, tenant, and HTTP authorization behavior
- `docs/phase-4-control-tower-foundation.md` — tenant-scoped active operations read model
- `docs/phase-4-control-tower-frontend.md` — authenticated responsive operational interface
- `docs/phase-4-acceptance.md` — real PostgreSQL, API, responsive, RTL, and download acceptance results
- `docs/phase-5-operational-intelligence-decision-pack.md` — approval gate for rules, exceptions, root causes, KPIs, decisions, actions, and alerts
- `docs/phase-5-operational-intelligence-foundation.md` — implemented Phase 5 rule resolution, exception workflow, API, and known boundaries
- `docs/phase-5-acceptance.md` — database-backed tenant, versioning, deduplication, reopening, alert, and KPI acceptance coverage

## Development policy

All endpoints are protected by default except those explicitly decorated as public. Health, login, refresh, and logout are currently public. User endpoints enforce backend permissions and derive organization scope from the authenticated principal, never from a request-supplied organization ID.

### Identity API

- `POST /api/v1/auth/login` — organization code, email, and password
- `POST /api/v1/auth/refresh` — rotate a refresh token
- `POST /api/v1/auth/logout` — revoke a refresh token
- `GET /api/v1/users` — requires `user.read`
- `POST /api/v1/users` — requires `user.create`
- `PATCH /api/v1/users/:id/status` — requires `user.update`
- `POST /api/v1/users/:id/roles` — requires `user.role.assign`; organization scope only
- `POST /api/v1/users/me/password` — changes the current password and revokes refresh sessions
- `GET /api/v1/roles` — requires `role.read`
- `GET /api/v1/roles/permissions` — requires `role.read`
- `POST /api/v1/roles` — requires `role.create`
- `PATCH /api/v1/roles/:id/permissions` — requires `role.update`
- `GET /api/v1/audit-logs` — requires `audit.read`
- `GET /api/v1/audit-logs/context` — tenant-scoped exception, rule-version, or KPI-version audit timeline; requires `audit.read`

### Client master data API

- `GET /api/v1/clients` — paginated search; requires `client.read`
- `GET /api/v1/clients/:id` — requires `client.read`
- `POST /api/v1/clients` — requires `client.create`
- `PATCH /api/v1/clients/:id` — requires `client.update`
- `POST /api/v1/clients/:id/archive` — requires `client.archive`

Client codes are immutable tenant-local identifiers. Archiving preserves the record and audit history; archived records are excluded from default list results.

### Carrier master data API

- `GET /api/v1/carriers` — paginated search; requires `carrier.read`
- `GET /api/v1/carriers/:id` — requires `carrier.read`
- `POST /api/v1/carriers` — requires `carrier.create`
- `PATCH /api/v1/carriers/:id` — requires `carrier.update`
- `POST /api/v1/carriers/:id/archive` — requires `carrier.archive`

Carrier codes are immutable tenant-local identifiers. Archive operations preserve historical references and audit records.

### Warehouse and branch APIs

Both resources support paginated list, detail, create, update, and archive operations:

- `/api/v1/warehouses`
- `/api/v1/branches`

Create requests require an active `clientId`. Codes are immutable and unique within the owning client. Addresses and coordinates are optional until client-specific location requirements are approved. Composite database foreign keys prevent a warehouse or branch from referencing a client in another organization.

### Driver and vehicle APIs

Both resources support paginated list, detail, create, update, and archive operations:

- `/api/v1/drivers`
- `/api/v1/vehicles`

Create requests require an active `carrierId`, and composite foreign keys prevent cross-organization carrier relationships. Driver license numbers and vehicle plates are unique within a carrier when supplied. Vehicle capacity is optional, but a capacity value and unit must be supplied together; the system does not interpret or convert units.

Initial identity provisioning is an explicit CLI operation and is not exposed over HTTP. It is idempotent for the organization, administrator, role, permissions, and assignment; it does not overwrite an existing administrator password.

### Mission Core API

- `GET /api/v1/missions` — tenant-scoped pagination and filtering; requires `mission.read`
- `GET /api/v1/missions/:id` — mission detail with ordered stops; requires `mission.read`
- `POST /api/v1/missions` — creates a `DRAFT` mission; requires `mission.create`
- `PATCH /api/v1/missions/:id` — updates planning fields only; requires `mission.update`
- `POST /api/v1/missions/:id/assign` — atomically assigns an active carrier, its vehicle, and its driver; requires `mission.assign`
- `POST /api/v1/missions/:id/transition` — applies the approved centralized lifecycle policy; requires `mission.transition`
- `POST /api/v1/missions/:id/stops` — adds a sequenced stop; requires `mission_stop.create`
- `PATCH /api/v1/mission-stops/:id` — updates stop planning fields; requires `mission_stop.update`
- `POST /api/v1/mission-stops/:id/arrive` — records ordered stop arrival; requires `mission_stop.arrive`
- `POST /api/v1/mission-stops/:id/start-unloading` — starts unloading after arrival; requires `mission_stop.unload`
- `POST /api/v1/mission-stops/:id/complete` — completes unloading and records supplied quantities; requires `mission_stop.complete`
- `GET /api/v1/missions/:id/events` — append-only event timeline; requires `mission.read`

Mission assignment does not implicitly change mission status. Status changes are accepted only through the transition endpoint and use optimistic concurrency protection. Cancellation requires a reason. Delivery requires at least one stop and every stop must be completed. Operational and accounting closure remain blocked until Phase 3 implements the required document policies.

Stop operations follow `PENDING -> ARRIVED -> UNLOADING -> COMPLETED`. A stop cannot arrive until every lower sequence is completed. Recorded times cannot move backward, and quantity values are stored exactly as supplied without calculations or unit conversion.

### Daily Loading API

- `GET /api/v1/daily-loading?from=<ISO timestamp>&to=<ISO timestamp>` — returns tenant-scoped scheduled missions, exact status counts, and per-mission stop progress; requires `daily_loading.read`

The caller supplies the UTC window so operation-specific time-zone boundaries remain explicit. Optional `clientId`, `warehouseId`, and `carrierId` filters are supported. Each mission includes its effective loading-rule status and persisted open loading-delay/data-quality exceptions. Summary counts come from backend exceptions; the read model does not recalculate delays or infer a KPI.

### Operational Intelligence API

- `GET|POST /api/v1/rule-configurations` — list or create immutable, effective-dated scoped rule versions; requires `rule.read` or `rule.manage`
- `GET /api/v1/rule-configurations/options` — tenant-scoped rule definitions, validated scope options, and assignable active owners; requires `rule.read`
- `POST /api/v1/rule-evaluations/reevaluate` — bounded deterministic manual time-rule reevaluation; requires `rule.evaluate`
- `GET /api/v1/exceptions` and `GET /api/v1/exceptions/:id` — tenant-scoped exception list and full traceability view; requires `exception.read`
- `POST /api/v1/exceptions/:id/assign` — assign or reassign an owner; requires `exception.manage`
- `POST /api/v1/exceptions/:id/severity` — change optional severity; requires `exception.manage`
- `POST /api/v1/exceptions/:id/resolve` — resolve an active exception; requires `exception.manage`
- `POST /api/v1/exceptions/:id/root-causes` — record a root cause; requires `root_cause.create`
- `POST /api/v1/exceptions/:id/decisions` — record a decision; requires `decision.create`
- `POST /api/v1/decisions/:id/actions` — create a corrective action; requires `action.create`
- `POST /api/v1/actions/:id/complete` — complete a corrective action; requires `action.update`
- `POST /api/v1/exceptions/:id/evidence` — attach an existing mission document as evidence; requires `exception.manage`
- `GET /api/v1/alerts` — paginated in-app exception alerts with unread filtering; requires `alert.read`
- `POST /api/v1/alerts/:id/read` — marks a tenant alert as read and audits the change; requires `alert.update`
- `GET|POST /api/v1/kpi-configurations` — list or create immutable effective-dated KPI contract versions; requires `kpi.read` or `kpi.manage`
- `GET /api/v1/kpi-configurations/options` — tenant-scoped candidate definitions and validated scope options; requires `kpi.read`

`LOADING_DELAY` has a configurable 30-minute product default. Other time thresholds are not supplied. Severity and ownership remain unset unless configured, and exceptions are non-blocking by default. All endpoint queries derive tenant scope from the authenticated principal.

The Control Tower includes an Exception workspace backed by these APIs. It provides filtering, fact inspection, assignment/reassignment, severity changes, evidence linking, root causes, decisions, corrective actions, completion, and resolution. Missing values are displayed explicitly and are never inferred by the browser.

The Rule Configuration workspace creates immutable effective-dated versions for organization, client, warehouse, and carrier scopes. Contract and route are intentionally not selectable until those master-data relationships exist. Working-calendar JSON is retained as versioned metadata but does not alter elapsed-time calculations without an approved schema.

Authorized operators can manually reevaluate one mission or a bounded schedule window at an explicit timestamp. Future operations are skipped; missing due timestamps remain data-quality conditions. Stable source-occurrence identifiers make repeated runs idempotent and prevent a resolved occurrence from reopening solely because the reevaluation command was repeated.

The Alerts workspace provides tenant-wide unread visibility and direct navigation to the underlying exception. Read status is persisted and audited; external delivery, retry, and escalation channels remain deferred until their policies are approved.

The KPI Registry stores versioned formula, eligibility, data-source, period, target, rounding, frequency, timezone, and scope contracts. Candidate definitions are disabled from calculation: the registry does not create KPI values, aggregates, carrier scores, or backfills.

Exception details and rule/KPI version history expose contextual audit timelines. Exception context includes related root-cause, decision, action, alert, evidence, ownership, severity, resolution, and reopen records when their audit payload identifies the exception.
