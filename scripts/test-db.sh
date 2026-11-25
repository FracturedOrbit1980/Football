#!/usr/bin/env bash
# Runs the migrations and the pgTAP tests in supabase/tests on a throwaway database.
#
#   With the Supabase CLI (recommended):   npx supabase start && npx supabase test db
#   With a plain local PostgreSQL + pgTAP:  scripts/test-db.sh
#
# The plain mode loads supabase/tests/local/supabase_stub.sql first to stand in for
# Supabase's auth and storage schemas. Set PSQL to override the psql command.
set -euo pipefail
cd "$(dirname "$0")/.."
PSQL=${PSQL:-psql}
DB=${TEST_DB:-football_rls_test}
$PSQL -v ON_ERROR_STOP=1 -q -d postgres -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB"
$PSQL -v ON_ERROR_STOP=1 -q -d "$DB" -c "CREATE EXTENSION IF NOT EXISTS pgtap" -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'
$PSQL -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase/tests/local/supabase_stub.sql
for file in supabase/migrations/*.sql; do
  echo "migrate: $file"
  $PSQL -v ON_ERROR_STOP=1 -q -d "$DB" -f "$file"
done
status=0
for file in supabase/tests/*.sql; do
  echo "test: $file"
  out=$($PSQL -v ON_ERROR_STOP=1 -X -tA -d "$DB" -f "$file" 2>&1) || status=1
  echo "$out"
  if echo "$out" | grep -qE '^not ok|Looks like you failed'; then status=1; fi
done
exit $status
