#!/bin/sh
set -eu

compose_file=docker-compose.test.yml

cleanup() {
  docker compose -f "$compose_file" down
}

trap cleanup EXIT INT TERM

docker compose -f "$compose_file" up -d --wait postgres-test

TEST_POSTGRES_PORT=${TEST_POSTGRES_PORT:-55432}
export DATABASE_URL="postgresql://wafi_test:wafi-test-local-only@127.0.0.1:${TEST_POSTGRES_PORT}/wafi_os_test?schema=public"
export NODE_ENV=test
export API_PORT=${API_PORT:-3001}
export CORS_ORIGINS=${CORS_ORIGINS:-http://localhost:3000}
export JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET:-runtime-acceptance-secret-32-characters}
export JWT_ACCESS_TTL_SECONDS=${JWT_ACCESS_TTL_SECONDS:-900}
export REFRESH_TOKEN_TTL_DAYS=${REFRESH_TOKEN_TTL_DAYS:-30}
export RATE_LIMIT_TTL_MS=${RATE_LIMIT_TTL_MS:-60000}
export RATE_LIMIT_MAX=${RATE_LIMIT_MAX:-120}
export DOCUMENT_STORAGE_LOCAL_PATH=${DOCUMENT_STORAGE_LOCAL_PATH:-./var/test-documents}
export DOCUMENT_MAX_SIZE_BYTES=${DOCUMENT_MAX_SIZE_BYTES:-10000000}

./scripts/runtime-acceptance.sh
