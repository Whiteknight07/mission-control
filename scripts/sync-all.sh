#!/usr/bin/env bash
# sync-all.sh — Master sync orchestrator for Mission Control
# Runs all sync tasks in sequence:
#   1. Sync cron jobs (OpenClaw → Convex scheduledTasks)
#   2. Sync workspace documents (.md files → Convex documents)
#   3. Log completion activity
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELAY_URL="${MC_RELAY_URL:-http://localhost:3002/events}"

echo "🐉 Mission Control — Full Sync"
echo "==============================="
echo ""

CRON_COUNT=0
DOC_COUNT=0
ERRORS=0

# ── 1. Sync Cron Jobs ──
echo "⏰ [1/3] Syncing cron jobs..."
if bash "$SCRIPT_DIR/sync-crons.sh" 2>/dev/null; then
  # Parse the last line of sync-crons output for counts
  CRON_OUTPUT=$(bash "$SCRIPT_DIR/sync-crons.sh" 2>/dev/null | tail -1)
  CRON_COUNT=$(echo "$CRON_OUTPUT" | grep -oP 'Synced \K[0-9]+' || echo "?")
else
  echo "  ⚠️  Cron sync encountered issues"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# ── 2. Sync Documents ──
echo "📄 [2/3] Syncing workspace documents..."
if bash "$SCRIPT_DIR/sync-docs.sh" 2>/dev/null; then
  DOC_OUTPUT=$(bash "$SCRIPT_DIR/sync-docs.sh" 2>/dev/null | tail -1)
  DOC_COUNT=$(echo "$DOC_OUTPUT" | grep -oP 'Indexed \K[0-9]+' || echo "?")
else
  echo "  ⚠️  Document sync encountered issues"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# ── 3. Log Sync Completed Activity ──
echo "📊 [3/3] Logging sync completion..."
TIMESTAMP=$(date +%s%3N)
SUMMARY="$CRON_COUNT crons, $DOC_COUNT docs synced"

if [ "$ERRORS" -gt 0 ]; then
  STATUS="error"
  SUMMARY="$SUMMARY ($ERRORS sync errors)"
else
  STATUS="success"
fi

ACTIVITY_PAYLOAD=$(python3 -c "
import json, sys
print(json.dumps({
    'type': 'system',
    'title': 'Sync complete',
    'description': sys.argv[1],
    'status': sys.argv[2],
    'timestamp': int(sys.argv[3])
}))
" "$SUMMARY" "$STATUS" "$TIMESTAMP")

if curl -s -f -X POST "$RELAY_URL" \
  -H "Content-Type: application/json" \
  -d "$ACTIVITY_PAYLOAD" \
  -o /dev/null 2>/dev/null; then
  echo "  ✅ Activity logged"
else
  echo "  ⚠️  Failed to log activity (relay may be down)"
fi

# ── Summary ──
echo ""
echo "==============================="
if [ "$ERRORS" -eq 0 ]; then
  echo "✅ All syncs complete!"
else
  echo "⚠️  Sync complete with $ERRORS errors"
fi
echo "   • Crons: $CRON_COUNT synced"
echo "   • Docs:  $DOC_COUNT indexed"
echo ""
echo "Refresh Mission Control to see updates."
