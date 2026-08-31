# Phase 3 closure policies

Mission closure requirements are client-scoped configuration. No client name or document formula is hardcoded.

## Policy lifecycle

A client has at most one policy for each stage:

- `OPERATIONAL_CLOSURE`, evaluated before `OPERATIONALLY_CLOSED`.
- `ACCOUNTING_READINESS`, evaluated before `ACCOUNTING_READY`.

Policies are saved as inactive drafts and must be activated explicitly. Active policies are immutable; deactivate a policy before editing it. Activation, deactivation, creation, and editing are audited.

If no active policy exists, the corresponding mission transition is blocked. An active policy with an empty requirements list deliberately authorizes the transition without documents. This distinguishes explicit configuration from missing configuration.

## Requirements

Each requirement selects a document type and scope:

- `MISSION`: one verified mission-level document of that type is required.
- `EACH_STOP`: every mission stop requires a verified stop-level document of that type.

All requirements in the active policy must be satisfied.

## API

- `GET /api/v1/closure-policies`
- `PUT /api/v1/closure-policies`
- `POST /api/v1/closure-policies/:id/activate`
- `POST /api/v1/closure-policies/:id/deactivate`

Reading requires `closure_policy.read`; mutation requires `closure_policy.manage`.

## Pending owner decisions

The owner must still define the actual requirements for each client. Policy history/versioning, effective dates, approval segregation, and whether rejected documents require explanatory notes remain future decisions.
