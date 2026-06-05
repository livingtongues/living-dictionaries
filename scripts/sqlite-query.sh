#!/bin/bash
# Query the live browser wa-sqlite DBs (admin shared.db + per-dict dict.db) via the dev proxy.
#
# Port mapping (derived from the actual bound Vite port; see site/sqlite-proxy/vite-plugin.ts):
#   pnpm dev  (3041) -> HTTP proxy on 4051
#   pnpm prod (3042) -> HTTP proxy on 4053
#
# Client addressing (composite client_id; see site/src/lib/db/client/live-share.svelte.ts):
#   admin shared.db -> "<email>"
#   a dict's dict.db -> "<email>::dict::<dict_id>"
# Without --dict the admin shared.db is queried; with --dict <id> the matching dict.db is.
#
# Usage:
#   sqlite-query.sh <sql> [params...]                  # admin shared.db, first available instance
#   sqlite-query.sh --dict <dict_id> <sql> [params...] # that dict's dict.db
#   sqlite-query.sh --port <http_port> <sql>           # specific proxy instance
#   sqlite-query.sh --status                           # all running instances + connected browsers
#
# Examples:
#   sqlite-query.sh "SELECT count(*) FROM users"
#   sqlite-query.sh --dict my-dictionary "SELECT count(*) FROM entries"
#   sqlite-query.sh "SELECT * FROM dictionaries WHERE id = ?" my-dictionary
#   sqlite-query.sh --status

set -euo pipefail

KNOWN_PORTS=(4051 4053)
PORT_LABELS=("dev:3041" "prod:3042")

check_port() {
  local port=$1
  curl -sf "http://localhost:${port}/clients" 2>/dev/null
}

show_status() {
  echo "SQLite Proxy Status"
  echo "==================="
  for i in "${!KNOWN_PORTS[@]}"; do
    local port=${KNOWN_PORTS[$i]}
    local label=${PORT_LABELS[$i]}
    local result
    if result=$(check_port "$port"); then
      local count
      count=$(echo "$result" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['clients']))" 2>/dev/null || echo "?")
      local clients
      clients=$(echo "$result" | python3 -c "
import sys, json
for c in json.load(sys.stdin)['clients']:
    cid = c['id']
    if '::dict::' in cid:
        email, dict_id = cid.split('::dict::', 1)
        print(f\"  - dict.db [{dict_id}] ({email}, since {c['connected_at']})\")
    else:
        print(f\"  - shared.db ({cid}, since {c['connected_at']})\")
" 2>/dev/null || echo "  (error reading clients)")
      echo ""
      echo "[$label] http://localhost:${port} - ${count} browser DB(s) connected"
      if [ -n "$clients" ]; then
        echo "$clients"
      fi
    else
      echo ""
      echo "[$label] http://localhost:${port} - not running"
    fi
  done
}

find_first_available_port() {
  for port in "${KNOWN_PORTS[@]}"; do
    if check_port "$port" >/dev/null 2>&1; then
      echo "$port"
      return 0
    fi
  done
  return 1
}

# Parse arguments
HTTP_PORT=""
DICT_ID=""

if [ "${1:-}" = "--status" ]; then
  show_status
  exit 0
fi

while true; do
  case "${1:-}" in
    --port)
      HTTP_PORT="$2"
      shift 2
      ;;
    --dict)
      DICT_ID="$2"
      shift 2
      ;;
    *)
      break
      ;;
  esac
done

if [ $# -lt 1 ]; then
  echo "Usage: sqlite-query.sh [--dict <dict_id>] [--port <http_port>] <sql> [params...]"
  echo "       sqlite-query.sh --status"
  exit 1
fi

SQL="$1"
shift

# Build params array
PARAMS="[]"
if [ $# -gt 0 ]; then
  PARAMS=$(python3 -c "
import sys, json
print(json.dumps(sys.argv[1:]))
" "$@")
fi

# Find port if not specified
if [ -z "$HTTP_PORT" ]; then
  HTTP_PORT=$(find_first_available_port) || {
    echo "Error: No SQLite proxy running. Start with 'pnpm dev' or 'pnpm prod' in site/" >&2
    exit 1
  }
fi

# Fetch connected clients and pick the right one for this target (admin vs dict).
CLIENTS_RESPONSE=$(curl -sf "http://localhost:${HTTP_PORT}/clients" 2>/dev/null) || {
  echo "Error: Cannot reach SQLite proxy on port ${HTTP_PORT}" >&2
  exit 1
}

CLIENT_ID=$(echo "$CLIENTS_RESPONSE" | python3 -c "
import sys, json
clients = json.load(sys.stdin)['clients']
dict_id = sys.argv[1] if len(sys.argv) > 1 else ''
if dict_id:
    suffix = '::dict::' + dict_id
    matches = [c['id'] for c in clients if c['id'].endswith(suffix)]
else:
    matches = [c['id'] for c in clients if '::dict::' not in c['id']]
if matches:
    print(matches[0])
" "$DICT_ID" 2>/dev/null)

if [ -z "$CLIENT_ID" ]; then
  if [ -n "$DICT_ID" ]; then
    echo "Error: No browser connected for dict '${DICT_ID}' on port ${HTTP_PORT}. Open /${DICT_ID} in a browser." >&2
  else
    echo "Error: No admin browser connected to proxy on port ${HTTP_PORT}. Open an /admin/* page and log in as admin." >&2
  fi
  exit 1
fi

# Execute query
BODY=$(python3 -c "
import json, sys
print(json.dumps({'sql': sys.argv[1], 'params': json.loads(sys.argv[2])}))
" "$SQL" "$PARAMS")

RESULT=$(curl -sf -X POST "http://localhost:${HTTP_PORT}/query?client=${CLIENT_ID}" \
  -H "Content-Type: application/json" \
  --data-binary "$BODY" 2>/dev/null) || {
  echo "Error: Query failed" >&2
  exit 1
}

# Pretty print result
echo "$RESULT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if not data.get('success', False):
    print(f\"Error: {data.get('error', 'Unknown error')}\", file=sys.stderr)
    sys.exit(1)
rows = data.get('rows', [])
fields = data.get('fields', [])
count = data.get('rowCount', len(rows))
if not rows:
    print(f'({count} row{\"s\" if count != 1 else \"\"})')
    sys.exit(0)
# Column widths
cols = [f.get('name', f'col{i}') for i, f in enumerate(fields)] if fields else list(rows[0].keys())
widths = [len(c) for c in cols]
str_rows = []
for row in rows:
    str_row = []
    for i, col in enumerate(cols):
        val = str(row.get(col, ''))
        if len(val) > 80:
            val = val[:77] + '...'
        str_row.append(val)
        widths[i] = max(widths[i], len(val))
    str_rows.append(str_row)
# Print table
header = ' | '.join(c.ljust(widths[i]) for i, c in enumerate(cols))
sep = '-+-'.join('-' * widths[i] for i in range(len(cols)))
print(header)
print(sep)
for str_row in str_rows:
    print(' | '.join(str_row[i].ljust(widths[i]) for i in range(len(cols))))
print(f'({count} row{\"s\" if count != 1 else \"\"})')
"
