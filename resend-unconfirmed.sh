#!/usr/bin/env bash
set -euo pipefail

DB_PATH="./data/stellar.db"
BASE_URL="https://dashboard.d3mon.de"
CONTAINER_NAME="stellar-lens"
FORCE=0

usage() {
  cat <<EOF
Usage:
  $0 [--force] [--db PATH] [--url URL] [--container NAME]

Options:
  --force           Actually send resend-confirm requests
  --db PATH         SQLite database path on host (default: ./data/stellar.db)
  --url URL         Base app URL (default: https://dashboard.d3mon.de)
  --container NAME  Podman container name (default: stellar-lens)
  -h, --help        Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force)
      FORCE=1
      shift
      ;;
    --db)
      DB_PATH="${2:?Missing value for --db}"
      shift 2
      ;;
    --url)
      BASE_URL="${2:?Missing value for --url}"
      shift 2
      ;;
    --container)
      CONTAINER_NAME="${2:?Missing value for --container}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if ! command -v curl >/dev/null 2>&1; then
  echo "Error: curl is not installed." >&2
  exit 1
fi

get_emails_from_host_db() {
  if command -v sqlite3 >/dev/null 2>&1 && [[ -f "$DB_PATH" ]]; then
    sqlite3 "$DB_PATH" "SELECT email FROM users WHERE confirmed = 0 AND email IS NOT NULL AND email != '' ORDER BY email;"
    return 0
  fi
  return 1
}

get_emails_from_container_node() {
  podman exec "$CONTAINER_NAME" node -e "
    const Database = require('better-sqlite3');
    const db = new Database('/app/data/stellar.db', { readonly: true });
    const rows = db.prepare(\"SELECT email FROM users WHERE confirmed = 0 AND email IS NOT NULL AND email != '' ORDER BY email\").all();
    for (const row of rows) console.log(row.email);
  "
}

if EMAIL_OUTPUT="$(get_emails_from_host_db 2>/dev/null)"; then
  :
else
  echo "Host sqlite3/DB unavailable, falling back to podman exec in $CONTAINER_NAME..." >&2
  EMAIL_OUTPUT="$(get_emails_from_container_node)"
fi

mapfile -t EMAILS < <(printf '%s\n' "$EMAIL_OUTPUT" | sed '/^[[:space:]]*$/d')

COUNT="${#EMAILS[@]}"

echo "URL:  $BASE_URL"
echo "Users not confirmed: $COUNT"
echo

if [[ "$COUNT" -eq 0 ]]; then
  echo "No unconfirmed users found."
  exit 0
fi

printf '%s\n' "${EMAILS[@]}"
echo

if [[ "$FORCE" -ne 1 ]]; then
  echo "Dry run only. Nothing sent."
  echo "Run again with --force to actually trigger confirmation mails."
  exit 0
fi

for email in "${EMAILS[@]}"; do
  echo "Sending confirmation mail to: $email"
  curl -sS -X POST "$BASE_URL/api/auth/resend-confirm" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\"}"
  echo
  echo "---"
  sleep 1
done

echo "Done."