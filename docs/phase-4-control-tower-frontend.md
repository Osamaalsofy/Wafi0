# Phase 4 Control Tower frontend

The web application now provides an authenticated operational interface backed by `GET /api/v1/control-tower`.

## Implemented interface

- Organization-aware sign-in through the real authentication API.
- Responsive desktop, tablet, and mobile layouts.
- Exact active, waiting-for-vehicle, loading, in-transit, and delivered status cards.
- Explicitly page-scoped document-attention count.
- Mission search and active-status filtering.
- Tenant-scoped client, warehouse, and carrier filters; warehouse choices narrow by client.
- Manual refresh plus optional 30- or 60-second polling, with a visible last-updated state.
- Automatic polling pauses while the mission detail drawer is open to keep the inspected record stable.
- Mission assignment, stop progress, and closure-document readiness.
- Read-only mission operations drawer backed by the mission, event-history, and document APIs.
- Mission overview, ordered stops, uploaded-document verification state, and chronological events.
- Authorized document downloads from the mission drawer through the protected content endpoint.
- Loading, empty, API failure, session, and authorization states.
- LTR/RTL direction switching using CSS logical properties.
- Accessible labels, semantic tables, status text, and reduced-motion handling.

The frontend does not calculate delay, SLA, exception, or KPI values. It renders the backend projection and explicitly states when delay evaluation is unavailable.

## Mission detail boundary

Selecting a mission starts three authorized requests for its persisted details, event history, and document metadata. Event and document histories use independent 20-record pages. Document binary content is requested only after an explicit download action; storage keys remain private. The drawer does not permit operational mutations. Events are displayed in the order returned by the backend.

## Authentication boundary

The browser client keeps the short-lived access token only in React memory and stores no token in local storage. The API places the rotating refresh token in an `HttpOnly`, `SameSite=Strict` cookie that is `Secure` in production. Reloading restores the session through the cookie, access tokens refresh before expiry, and sign-out revokes the server session and clears the cookie.

## Configuration

`NEXT_PUBLIC_API_URL` identifies the versioned API base URL and defaults locally to `http://localhost:3001/api/v1`.
