#!/usr/bin/env bash
# mc-cron-wrapper.sh — Wrapper for cron job activity logging
# Usage: mc-cron-wrapper.sh <job-name> <status> [description]
#
# This script does two things:
# 1. Logs a "cron" activity to the relay for the activity feed
# 2. Calls scheduledTasks:markFired to update lastRun on the calendar
#
# Examples:
#   mc-cron-wrapper.sh "Morning Briefing" success "Daily briefing delivered"
#   mc-cron-wrapper.sh "Gmail Check" error "OAuth token expired"
set -euo pipefail

RELAY_URL="${MC_RELAY_URL:-http://localhost:3002/events}"
CONVEX_URL="${MC_CONVEX_URL:-https://careful-gnat-191.convex.cloud}"

# Validate arguments
if [ $# -lt 2 ]; then
  echo "Usage: mc-cron-wrapper.sh <job-name> <status> [description]"
  echo ""
  echo "  job-name:    Name of the cron job (must match OpenClaw cron name)"
  echo "  status:      success, error, or pending"
  echo "  description: Optional description of what happened"
  exit 1
fi

JOB_NAME="$1"
STATUS="$2"
DESCRIPTION="${3:-$JOB_NAME completed}"
TIMESTAMP=$(date +%s%3N)

# 1. Log activity to relay
ACTIVITY_PAYLOAD=$(python3 -c "
import json, sys
print(json.dumps({
    'type': 'cron',
    'title': sys.argv[1] + ' fired',
    'description': sys.argv[2],
    'status': sys.argv[3],
    'timestamp': int(sys.argv[4])
}))
" "$JOB_NAME" "$DESCRIPTION" "$STATUS" "$TIMESTAMP")

if curl -s -f -X POST "$RELAY_URL" \
  -H "Content-Type: application/json" \
  -d "$ACTIVITY_PAYLOAD" \
  -o /dev/null 2>/dev/null; then
  echo "✅ Activity logged: $JOB_NAME"
else
  echo "⚠️  Failed to log activity (relay may be down)"
fi

# 2. Update calendar via Convex mutation
MUTATION_PAYLOAD=$(python3 -c "
import json, sys
print(json.dumps({
    'path': 'scheduledTasks:markFired',
    'args': {'name': sys.argv[1]},
    'format': 'json'
}))
" "$JOB_NAME")

if curl -s -f -X POST "$CONVEX_URL/api/mutation" \
  -H "Content-Type: application/json" \
  -d "$MUTATION_PAYLOAD" \
  -o /dev/null 2>/dev/null; then
  echo "✅ Calendar updated: $JOB_NAME"
else
  echo "⚠️  Failed to update calendar (Convex may be unreachable)"
fi
