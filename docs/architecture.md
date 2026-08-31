# Architecture assessment

## Current state

The repository was empty at the start of Phase 0. The supplied specification is a founding business brief and implementation blueprint. It defines WAFI OS as a multi-tenant logistics operations platform whose central future aggregate is Mission, but it leaves several operational rules pending owner approval.

## Phase 0 decisions

- Use a pnpm TypeScript monorepo with independently deployable Next.js web and NestJS API applications.
- Keep the API as a modular monolith. This preserves clear domain boundaries without introducing distributed-system costs.
- Use PostgreSQL and Prisma migrations. No domain tables are created in Phase 0; identity and tenancy models belong to Phase 1 and require explicit scoping decisions.
- Use versioned REST under `/api/v1` and publish OpenAPI at `/api/docs`.
- Validate configuration at API startup and fail fast on missing or malformed values.
- Keep Redis, BullMQ, object storage, and external integrations out of Phase 0. Add adapters when a use case requires them.
- Treat Arabic/English and RTL readiness as frontend constraints from the outset; localization content starts with product screens.

## Target structure

```text
wafi-os/
├── apps/
│   ├── api/                 # NestJS, Prisma schema/migrations, API tests
│   └── web/                 # Next.js App Router
├── packages/
│   ├── config/              # Shared non-secret constants
│   ├── types/               # Stable cross-application contracts
│   ├── ui/                  # Reusable accessible UI
│   └── validation/          # Shared request/form schemas
├── docs/                    # Architecture, assumptions, business-rule notes
├── docker/                  # Future image definitions when deployment begins
├── scripts/                 # Future repeatable operational scripts
├── docker-compose.yml       # Local infrastructure
└── README.md
```

Empty `docker/` and `scripts/` directories are not committed until they contain an actual artifact.

## Dependencies between phases

Phase 1 identity, RBAC, scope authorization, and tenant/client master data establish the security boundary required by every later module. Mission work must wait for that boundary. Documents, Control Tower, exceptions, KPIs, and integrations depend on Mission and its event history.
