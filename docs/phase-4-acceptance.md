# Phase 4 acceptance

Acceptance was executed on 2026-08-10 against an isolated PostgreSQL 15 database named `wafi_os_acceptance`, the compiled NestJS API, and the production Next.js server.

Docker was unavailable on the test host. The existing `wafi_os` database contained an unrelated legacy schema and was not modified.

## Verified

- All nine migrations apply cleanly to an empty database.
- Identity bootstrap provisions an organization administrator and remains idempotent.
- Authentication reaches the Control Tower using the real API.
- Tenant-scoped client, warehouse, carrier, mission, stop, document, and event data render correctly.
- Mission status summary, master-data filters, manual refresh, and polling state operate against persisted data.
- Mission detail shows assignment, ordered stops, document metadata, and ten persisted lifecycle events.
- Opening mission details pauses automatic refresh.
- Protected document content downloads successfully with bearer authorization and matches the stored 77-byte acceptance fixture.
- Desktop layout at 1440×900 renders without overlap.
- Mobile layout at 390×844 contains the wide mission table in its horizontal scroller; document width remains equal to viewport width.
- RTL switches the root direction to `rtl`, language to `ar`, and retains a 390-pixel page width at the mobile viewport.
- No browser console errors or warnings were observed.

## Acceptance fixture

The repository includes `apps/api/test/fixtures/acceptance-waybill.pdf`, a minimal non-sensitive PDF fixture used to verify upload and protected download behavior.

## Finding corrected during acceptance

The generated Prisma client used ESM-only `import.meta` syntax while the API TypeScript output was CommonJS. This allowed compilation but prevented the compiled API and bootstrap script from starting. Prisma generation now explicitly uses CommonJS, and the identity bootstrap command builds and runs the compiled entrypoint.

## Remaining boundaries

- Docker Compose itself was not executable because Docker is not installed on the acceptance host.
- Business delay evaluation remains intentionally unavailable until SLA thresholds and calendars are approved.
- Client-level user scopes within one organization remain pending owner confirmation.
