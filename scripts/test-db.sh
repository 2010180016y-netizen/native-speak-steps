#!/usr/bin/env bash
# Applies the schema to a fresh database with Neon stubs, then runs the SQL tests in db/tests.
# Needs a Postgres 16 server, reached through the standard PG* variables:
#   docker run -d -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
#   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres npm run test:db
set -euo pipefail
cd "$(dirname "$0")/.."

export PGDATABASE=langsync_test
run() { psql -X -q -v ON_ERROR_STOP=1 -o /dev/null "$@"; }

dropdb --if-exists "$PGDATABASE"
createdb "$PGDATABASE"
run -f db/tests/setup.sql
for f in db/migrations/*.sql; do
  run -f "$f"
done
for f in db/tests/*.test.sql; do
  echo "== $f"
  run -f "$f"
done
echo "database tests passed"
