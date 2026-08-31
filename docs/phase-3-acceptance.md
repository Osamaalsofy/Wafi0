# Phase 3 acceptance

Phase 3 is accepted at the application and HTTP authorization boundaries.

## Verified workflow

The acceptance scenario now verifies:

1. A delivered mission cannot close without an active operational policy.
2. An active `EACH_STOP` POD requirement blocks closure while the stop POD is absent.
3. Uploading and verifying the stop POD permits `OPERATIONALLY_CLOSED`.
4. A mission-level waybill requirement blocks accounting readiness while absent.
5. Uploading and verifying the waybill permits `ACCOUNTING_READY`.
6. The mission can then transition to `CLOSED`.

## HTTP authorization

The closure-policy HTTP API verifies:

- unauthenticated access is rejected;
- read-only users can list policies but cannot mutate them;
- users with `closure_policy.manage` can create and activate policies;
- an authorized user still cannot configure a client in another organization.

## Deferred decisions

Production policy values remain owner-controlled. Effective dates, policy version history, approval segregation, malware scanning, storage retention, and document replacement remain outside the accepted scope.
