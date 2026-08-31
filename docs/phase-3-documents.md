# Phase 3 documents foundation

## Implemented scope

- Reusable document metadata linked to a mission and, optionally, one of that mission's stops.
- Document types: `WAYBILL`, `GATE_PASS`, `POD`, `SHORTAGE_PROOF`, `RETURN_PROOF`, and `OTHER`.
- Local-development file storage behind a provider-neutral interface.
- PDF, JPEG, and PNG upload validation with a configurable maximum size.
- Tenant-scoped listing, lookup, upload, and verification.
- `PENDING`, `VERIFIED`, and `REJECTED` verification states with actor, timestamp, notes, and audit records.

Binary content is not stored in PostgreSQL. Only an opaque storage key and safe metadata are persisted. The local provider stores files below `DOCUMENT_STORAGE_LOCAL_PATH`; a future S3-compatible provider can implement the same interface.

## Deliberate boundaries

- This slice does not define which document types are mandatory.
- Document verification does not yet unlock `OPERATIONALLY_CLOSED` or `ACCOUNTING_READY`.
- Stored files are immutable through the current API. Replacement and retention policies require owner approval.
- Signed URLs are deferred until access-delivery requirements and the production storage provider are selected. The current API streams content through its authorization boundary.

## API

- `GET /api/v1/documents`
- `GET /api/v1/documents/:id`
- `GET /api/v1/documents/:id/content`
- `POST /api/v1/documents` using `multipart/form-data`
- `POST /api/v1/documents/:id/verify`

The upload form accepts `missionId`, optional `stopId`, `type`, and `file`.

Content retrieval requires `document.read`, is tenant-scoped, uses attachment headers, disables caching and MIME sniffing, and never exposes the internal storage key. Uploads are checked against PDF, JPEG, or PNG file signatures in addition to their declared MIME type.
