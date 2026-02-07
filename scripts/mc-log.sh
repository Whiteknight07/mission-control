#!/usr/bin/env bash
# mc-log — Universal activity logger for Mission Control
# Usage: mc-log <type> <title> [description] [status]
# Types: email, code, cron, search, message, file, browser, system, error
#
# Examples:
#   mc-log cron "Morning Briefing fired" "Daily briefing delivered to Discord" success
#   mc-log code "Nightly build complete" "Built inframap v2" success
#   mc-log error "Build failed" "TypeScript compilation error" error
set -euo pipefail

RELAY_URL="${MC_RELAY_URL:-http://localhost:3002/events}"

# Validate arguments
if [ $# -lt 2 ]; then
  echo "Usage: mc-log <type> <title> [description] [status]"
  echo ""
  echo "Types: email, code, cron, search, message, file, browser, system, error"
  echo "Status: success (default), error, pending"
  exit 1
fi

TYPE="$1"
TITLE="$2"
DESCRIPTION="${3:-}"
STATUS="${4:-success}"
TIMESTAMP=$(date +%s%3N)

# Validate type
VALID_TYPES="email code cron search message file browser system error"
if ! echo "$VALID_TYPES" | grep -qw "$TYPE"; then
  echo "⚠️  Warning: Unknown type '$TYPE' — valid types: $VALID_TYPES"
fi

# Map user-friendly types to relay event types
case "$TYPE" in
  cron) EVENT="cron_fire" ;;
  message) EVENT="message_sent" ;;
  file) EVENT="file_changed" ;;
  error) EVENT="error" ;;
  *) EVENT="tool_call" ;;
esac

# Build JSON payload (escape special characters)
PAYLOAD=$(python3 -c "
import json, sys
print(json.dumps({
    'event': sys.argv[1],
    'tool': sys.argv[2],
    'title': sys.argv[3],
    'description': sys.argv[4],
    'status': sys.argv[5],
    'timestamp': int(sys.argv[6])
}))
" "$EVENT" "$TYPE" "$TITLE" "$DESCRIPTION" "$STATUS" "$TIMESTAMP")

# POST to relay
if curl -s -f -X POST "$RELAY_URL" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  -o /dev/null 2>/dev/null; then
  echo "✅ Logged: [$TYPE] $TITLE"
else
  echo "❌ Failed to log activity (relay at $RELAY_URL may be down)"
  exit 1
fi
