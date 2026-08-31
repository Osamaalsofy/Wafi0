#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo 'DATABASE_URL is required for runtime acceptance.' >&2
  exit 1
fi

database_path=${DATABASE_URL#*://}
database_path=${database_path#*/}
database_name=${database_path%%\?*}
database_name=${database_name%%#*}

case "$database_name" in
  *_test) ;;
  *)
    echo 'Refusing runtime acceptance: DATABASE_URL database name must end in _test.' >&2
    exit 1
    ;;
esac

pnpm db:generate
pnpm db:deploy
pnpm typecheck
pnpm lint
pnpm test
pnpm --filter @wafi/api test:integration
pnpm --filter @wafi/api test:e2e
