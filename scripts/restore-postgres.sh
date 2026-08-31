#!/usr/bin/env bash
set -euo pipefail

: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required}"
: "${BACKUP_FILE:?BACKUP_FILE is required}"
: "${CONFIRM_RESTORE:?Set CONFIRM_RESTORE=RESTORE_WAFI_DATABASE}"

test "${CONFIRM_RESTORE}" = 'RESTORE_WAFI_DATABASE' || { echo 'Restore confirmation is invalid' >&2; exit 2; }
test -f "${BACKUP_FILE}" && test ! -L "${BACKUP_FILE}"
test -f "${BACKUP_FILE}.sha256"
shasum -a 256 -c "${BACKUP_FILE}.sha256"
pg_restore --list "${BACKUP_FILE}" >/dev/null

printf '%s\n' 'Validated restore target and backup. Restoring database.'
pg_restore --dbname="${RESTORE_DATABASE_URL}" --clean --if-exists --no-owner --no-acl --exit-on-error "${BACKUP_FILE}"
printf '%s\n' 'Restore completed. Run migrations and production readiness checks before routing traffic.'
