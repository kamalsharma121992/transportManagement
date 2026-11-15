#!/usr/bin/env bash
# Run pending additive Supabase SQL migrations only. Never resets or wipes data.
# Tracks applied files in public.schema_migrations so already-run files are skipped.
#
# Usage:
#   ./migrate.sh              # run only pending migrations
#   ./migrate.sh --list       # show applied vs pending
#   ./migrate.sh --baseline   # mark all listed migrations applied (no SQL run)
#   ./migrate.sh --force file.sql   # re-run one file even if already applied
#   ./migrate.sh file.sql ... # run only those files if still pending
#
# Never runs: seed.sql, clean-migrate*, or anything named reset/wipe.
#
# Requires: psql on PATH, DATABASE_URL in .env or .env.local

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

load_env_file() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ -z "$line" || "$line" == \#* ]] && continue
    [[ "$line" != *=* ]] && continue
    local key="${line%%=*}"
    local value="${line#*=}"
    key="${key#"${key%%[![:space:]]*}"}"
    key="${key%"${key##*[![:space:]]}"}"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    [[ -z "$key" || -n "${!key+x}" ]] && continue
    if [[ "$value" == \"*\" && "$value" == *\" ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
      value="${value:1:${#value}-2}"
    fi
    export "$key=$value"
  done < "$file"
}

load_env_file ".env.local"
load_env_file ".env"

DB_URL="${DATABASE_URL:-${SUPABASE_DB_URL:-${POSTGRES_URL:-}}}"

MIGRATIONS=(
  "supabase/schema.sql"
  "supabase/expense_categories.sql"
  "supabase/credit_cards.sql"
  "supabase/credit_card_bill_dates.sql"
  "supabase/app_users.sql"
  "supabase/audit_entity.sql"
  "supabase/trip_payment.sql"
  "supabase/trip_partial_payment.sql"
  "supabase/trip_notes.sql"
  "supabase/expense_notes.sql"
  "supabase/monthly_notes.sql"
  "supabase/monthly_notes_sort_order.sql"
  "supabase/monthly_notes_position.sql"
  "supabase/expense_descriptions.sql"
  "supabase/unify_other_category.sql"
  "supabase/routes_commission.sql"
  "supabase/trip_builty.sql"
  "supabase/expense_image.sql"
  "supabase/multi_images.sql"
  "supabase/capital_source_expense.sql"
  "supabase/expense_advances.sql"
  "supabase/driver_payroll.sql"
  "supabase/dashboard_stats.sql"
  "supabase/reports.sql"
)

is_forbidden_file() {
  local base
  base="$(basename "$1" | tr '[:upper:]' '[:lower:]')"
  case "$base" in
    seed.sql|seed*.sql|*reset*|*wipe*|*clean-migrate*|*clean_migrate*)
      return 0
      ;;
  esac
  case "$1" in
    scripts/clean-migrate*|scripts/clean_migrate*)
      return 0
      ;;
  esac
  return 1
}

psql_q() {
  psql -v ON_ERROR_STOP=1 -Atq "$DB_URL" -c "$1"
}

ensure_migrations_table() {
  psql -v ON_ERROR_STOP=1 -q "$DB_URL" <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
SQL
}

migration_applied() {
  local f="$1"
  local count
  count="$(psql_q "SELECT COUNT(*) FROM schema_migrations WHERE filename = '$f'")"
  [[ "$count" == "1" ]]
}

record_migration() {
  local f="$1"
  psql -v ON_ERROR_STOP=1 -q "$DB_URL" -c \
    "INSERT INTO schema_migrations (filename) VALUES ('$f') ON CONFLICT (filename) DO NOTHING;"
}

baseline_migrations() {
  local f
  for f in "${MIGRATIONS[@]}"; do
    [[ -f "$f" ]] || continue
    is_forbidden_file "$f" && continue
    record_migration "$f"
    echo "  baseline: $f"
  done
}

maybe_auto_baseline() {
  local tracked partners
  tracked="$(psql_q "SELECT COUNT(*) FROM schema_migrations")"
  if [[ "$tracked" != "0" ]]; then
    return 0
  fi
  partners="$(psql_q "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'partners'")"
  if [[ "$partners" == "1" ]]; then
    echo "Existing database detected and no migration history yet."
    echo "Marking current migration list as already applied (no SQL re-run)."
    baseline_migrations
    echo ""
  fi
}

LIST_ONLY=0
BASELINE=0
FORCE=0
CUSTOM_FILES=()

for arg in "$@"; do
  case "$arg" in
    --seed|--reset|--wipe)
      echo "Refusing: ./migrate.sh never runs seed/reset/wipe." >&2
      exit 1
      ;;
    --list) LIST_ONLY=1 ;;
    --baseline) BASELINE=1 ;;
    --force) FORCE=1 ;;
    -h|--help)
      sed -n '2,16p' "$0"
      exit 0
      ;;
    *)
      if [[ "$arg" == supabase/* ]]; then
        CUSTOM_FILES+=("$arg")
      elif [[ -f "supabase/$arg" ]]; then
        CUSTOM_FILES+=("supabase/$arg")
      elif [[ -f "$arg" ]]; then
        CUSTOM_FILES+=("$arg")
      else
        echo "Unknown argument or file not found: $arg" >&2
        exit 1
      fi
      ;;
  esac
done

FILES=()
if [[ ${#CUSTOM_FILES[@]} -gt 0 ]]; then
  FILES=("${CUSTOM_FILES[@]}")
else
  FILES=("${MIGRATIONS[@]}")
fi

if [[ -z "$DB_URL" ]]; then
  cat <<EOF
No DATABASE_URL (or SUPABASE_DB_URL / POSTGRES_URL) found.
Add it to .env, then re-run ./migrate.sh
EOF
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is not installed or not on PATH." >&2
  exit 1
fi

ensure_migrations_table

if [[ "$BASELINE" -eq 1 ]]; then
  echo "=== Baseline: mark migrations applied (no SQL) ==="
  baseline_migrations
  echo "=== Done ==="
  exit 0
fi

# First use on an already-migrated DB: record history without re-running
if [[ ${#CUSTOM_FILES[@]} -eq 0 && "$FORCE" -eq 0 ]]; then
  maybe_auto_baseline
fi

echo "=== Transport Management migrations (pending only) ==="
echo "Root: $ROOT"

PENDING=()
for f in "${FILES[@]}"; do
  if is_forbidden_file "$f"; then
    echo "  BLOCKED  $f"
    continue
  fi
  if [[ ! -f "$f" ]]; then
    echo "  MISSING  $f"
    continue
  fi
  if [[ "$FORCE" -eq 0 ]] && migration_applied "$f"; then
    echo "  SKIP     $f (already applied)"
    continue
  fi
  echo "  PENDING  $f"
  PENDING+=("$f")
done

if [[ "$LIST_ONLY" -eq 1 ]]; then
  exit 0
fi

if [[ ${#PENDING[@]} -eq 0 ]]; then
  echo ""
  echo "Nothing to run — all selected migrations already applied."
  exit 0
fi

RAN=0
SKIPPED=0

for f in "${PENDING[@]}"; do
  echo ""
  echo ">>> Running $f"
  if psql -v ON_ERROR_STOP=1 -f "$f" "$DB_URL"; then
    record_migration "$f"
    echo "OK  $f"
    RAN=$((RAN + 1))
  else
    echo "FAIL $f" >&2
    echo "Stopped on first error. Fix the SQL, then re-run ./migrate.sh" >&2
    exit 1
  fi
done

echo ""
echo "=== Done: $RAN ran, already-applied skipped ==="
