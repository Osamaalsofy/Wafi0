# WAFI OS production operations runbook

## Service objectives

- Recovery point objective (RPO): **15 minutes or less** for PostgreSQL. Use managed PostgreSQL continuous WAL/PITR with a retention window of at least 35 days. The repository backup script is a daily independently restorable copy; it does not replace PITR.
- Recovery time objective (RTO): **4 hours or less** from incident declaration to validated service restoration.
- Documents: enable bucket versioning, server-side encryption, object-lock/retention where required, and cross-region replication. Provider activation and credentials remain deployment responsibilities.

## Monitoring and alerting

Probe `GET /api/v1/health` for process liveness and `GET /api/v1/health/ready` for PostgreSQL, Redis, queue and connected-worker readiness. Alert after three consecutive readiness failures. The authenticated `GET /api/v1/jobs/health` response includes queue counts, connected workers, failed/dead-letter count and the latest failures; `GET /api/v1/jobs/failed?limit=25` provides the audit-authorized failure detail.

Collect the JSON API access logs and worker events (`job.completed`, `job.failed`) centrally. Alert on any dead-letter item, no connected worker, repeated 5xx responses, readiness failure, PostgreSQL replication lag approaching 10 minutes, backup/PITR failure, disk pressure, and S3 replication failure. Redact authorization, cookies, passwords, database URLs and provider secrets at ingestion.

## Backup schedule and verification

1. Configure managed PostgreSQL PITR/WAL archiving continuously and verify replication lag stays below 10 minutes.
2. Run `scripts/backup-postgres.sh` daily from a restricted backup runner with `DATABASE_URL` and `BACKUP_DIRECTORY` injected by the secret manager.
3. Encrypt and replicate the resulting `.dump` and `.sha256` files to a separate account/region. Apply immutable 35-day retention there; lifecycle deletion belongs to the provider policy, not the application script.
4. Alert if no verified backup has completed in 24 hours.
5. Restore the newest backup into an isolated database every month, run migrations and smoke checks, record duration and evidence, and correct any result that threatens the four-hour RTO.

## Database restore

Restoration is destructive and must target a newly provisioned or explicitly approved database. Never point the restore script at an unverified URL.

1. Declare the incident, freeze writes and record the target recovery timestamp.
2. Prefer managed PITR to a point immediately before corruption. Otherwise download the latest verified independent dump and checksum.
3. Provision an isolated PostgreSQL instance with the same major version and extensions.
4. Set `RESTORE_DATABASE_URL`, `BACKUP_FILE`, and `CONFIRM_RESTORE=RESTORE_WAFI_DATABASE`; run `scripts/restore-postgres.sh`.
5. Run `pnpm db:deploy`, `pnpm db:validate`, API integration/E2E tests, and the production smoke script against the restored environment.
6. Reconcile object-storage document references and verify a sample of checksums/downloads.
7. Rotate database credentials, switch traffic, resume workers, observe queue depth and error rate, and retain the old database read-only until sign-off.

## Regional disaster recovery

Within 30 minutes, the incident commander selects the recovery point and activates the secondary region. Within 90 minutes, restore PostgreSQL/PITR and validate replicated document storage. Within 150 minutes, deploy API, worker and web images using secret-manager references, run migrations and readiness checks. By 210 minutes, run authentication, mission, document, exception, report and worker smoke workflows. Route traffic no later than 240 minutes if validation passes; otherwise keep the maintenance page active and escalate.

After recovery, verify tenant isolation, RBAC, audit continuity, queue/dead-letter state and document access before reopening writes. Record achieved RPO/RTO and complete a blameless review within two business days.

## Secrets and configuration

Do not store production values in Git, images, Compose files or CI logs. Inject database, JWT, Redis, S3 and email/provider credentials from the deployment secret manager; use separate identities and least privilege for API, workers, backups and CI. Rotate JWT/provider credentials at least every 90 days and immediately after suspected exposure. Production startup validation rejects placeholder JWT and unsafe CORS configuration; deployment must additionally block placeholder values in `.env.production.example` and scan both repository history and built images.
