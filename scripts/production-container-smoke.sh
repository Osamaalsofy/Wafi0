#!/bin/sh
set -eu

compose_file=docker-compose.production.yml
COMPOSE_PROJECT_NAME="wafi-production-smoke-$$"
export COMPOSE_PROJECT_NAME

case "$COMPOSE_PROJECT_NAME" in
  wafi-production-smoke-[0-9]*) ;;
  *)
    echo 'Refusing to run with an unexpected Compose project name.' >&2
    exit 1
    ;;
esac

export POSTGRES_DB=wafi_os_smoke
export POSTGRES_USER=wafi_smoke
export POSTGRES_PASSWORD=wafi-smoke-database-password
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public"
export API_PORT=${SMOKE_API_PORT:-33001}
export WEB_PORT=${SMOKE_WEB_PORT:-33000}
export NEXT_PUBLIC_API_URL="http://127.0.0.1:${API_PORT}/api/v1"
export CORS_ORIGINS=https://app.smoke.example
export JWT_ACCESS_SECRET=wafi-production-smoke-secret-32-characters
export S3_BUCKET=wafi-production-smoke-documents

cleanup() {
  docker compose -p "$COMPOSE_PROJECT_NAME" -f "$compose_file" down --volumes --remove-orphans
}

trap cleanup EXIT INT TERM

docker compose -p "$COMPOSE_PROJECT_NAME" -f "$compose_file" config --quiet
docker compose -p "$COMPOSE_PROJECT_NAME" -f "$compose_file" build
docker compose -p "$COMPOSE_PROJECT_NAME" -f "$compose_file" up -d --wait

node -e "fetch('http://127.0.0.1:${API_PORT}/api/v1/health').then((response) => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"
node -e "fetch('http://127.0.0.1:${API_PORT}/api/v1/health/ready').then((response) => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"
node -e "fetch('http://127.0.0.1:${WEB_PORT}').then((response) => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"
