#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_DIRECTORY:?BACKUP_DIRECTORY is required}"

case "${BACKUP_DIRECTORY}" in
  /|"${HOME}"|"${HOME}/") echo 'Refusing unsafe backup directory' >&2; exit 2 ;;
esac

mkdir -p -- "${BACKUP_DIRECTORY}"
test -d "${BACKUP_DIRECTORY}" && test ! -L "${BACKUP_DIRECTORY}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_path="${BACKUP_DIRECTORY}/wafi-${timestamp}.dump"

pg_dump --dbname="${DATABASE_URL}" --format=custom --compress=9 --no-owner --no-acl --file="${backup_path}"
pg_restore --list "${backup_path}" >/dev/null
shasum -a 256 "${backup_path}" > "${backup_path}.sha256"
chmod 0600 "${backup_path}" "${backup_path}.sha256"
printf '%s\n' "Backup verified: ${backup_path}"
