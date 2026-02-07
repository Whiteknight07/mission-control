#!/usr/bin/env bash
# Sync OpenClaw cron jobs → Convex scheduledTasks (calendar view)
# Run periodically or on-demand: bash scripts/sync-crons.sh
# Usage: sync-crons.sh [--quiet|-q]
set -euo pipefail

CONVEX_URL="${MC_CONVEX_URL:-https://careful-gnat-191.convex.cloud}"
RELAY_URL="${MC_RELAY_URL:-http://localhost:3002/events}"

QUIET=false
if [ "${1:-}" = "--quiet" ] || [ "${1:-}" = "-q" ]; then
  QUIET=true
fi

log() {
  if [ "$QUIET" = false ]; then
    echo "$@"
  fi
}

log "⏰ Syncing OpenClaw crons → Mission Control calendar..."

# Get cron list as JSON
# openclaw outputs log prefixes before JSON — extract only the JSON part
CRON_RAW=$(openclaw cron list --json 2>/dev/null || echo "{}")
CRON_JSON=$(echo "$CRON_RAW" | sed -n '/^{/,$ p')

export MC_CONVEX_URL="$CONVEX_URL"
export MC_CRON_JSON="$CRON_JSON"
export MC_QUIET="$QUIET"

RESULT=$(python3 << 'PYEOF'
import json, os, sys, urllib.request

CONVEX_URL = os.environ["MC_CONVEX_URL"]
raw = os.environ["MC_CRON_JSON"]
quiet = os.environ.get("MC_QUIET", "false") == "true"

def log(msg):
    if not quiet:
        print(msg)

try:
    data = json.loads(raw)
except:
    log("  ❌ Failed to parse cron list JSON")
    print("0,0,1")  # synced,total,error_flag
    sys.exit(0)

jobs = data if isinstance(data, list) else data.get("jobs", [])
if not jobs:
    log("  No cron jobs found")
    print("0,0,0")
    sys.exit(0)

synced, errors = 0, 0
for job in jobs:
    name = job.get("name") or job.get("id", "unknown")
    enabled = job.get("enabled", True)

    # Build schedule string
    sched = job.get("schedule", {})
    kind = sched.get("kind", "unknown")
    if kind == "cron":
        schedule_str = sched.get("expr", "unknown")
        if sched.get("tz"):
            schedule_str += f" ({sched['tz']})"
    elif kind == "every":
        ms = sched.get("everyMs", 0)
        if ms >= 3600000:
            schedule_str = f"every {ms // 3600000}h"
        elif ms >= 60000:
            schedule_str = f"every {ms // 60000}m"
        else:
            schedule_str = f"every {ms // 1000}s"
    elif kind == "at":
        schedule_str = f"one-shot at {sched.get('at', 'unknown')}"
    else:
        schedule_str = json.dumps(sched)

    # Determine type
    task_type = "cron"
    if "reminder" in name.lower():
        task_type = "reminder"

    # Get timing info
    next_fire = job.get("nextFireTime")
    last_run = job.get("lastRunTime") or job.get("lastRunAt")

    payload = {
        "path": "scheduledTasks:upsertByName",
        "args": {
            "name": name,
            "schedule": schedule_str,
            "type": task_type,
            "enabled": enabled,
        },
        "format": "json",
    }

    if next_fire:
        payload["args"]["nextFire"] = next_fire
    if last_run:
        payload["args"]["lastRun"] = last_run

    try:
        req = urllib.request.Request(
            f"{CONVEX_URL}/api/mutation",
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
        )
        resp = urllib.request.urlopen(req, timeout=10)
        result = json.loads(resp.read())
        action = result.get("value", {}).get("action", "synced")
        synced += 1
        log(f"  ✅ {name} ({action})")
    except Exception as e:
        errors += 1
        log(f"  ❌ {name}: {e}")

log(f"\nSynced {synced}/{len(jobs)} jobs ({errors} errors)")
print(f"{synced},{len(jobs)},{errors}")
PYEOF
)

# Parse result for activity logging
SYNCED=$(echo "$RESULT" | tail -1 | cut -d, -f1)
TOTAL=$(echo "$RESULT" | tail -1 | cut -d, -f2)
ERRORS=$(echo "$RESULT" | tail -1 | cut -d, -f3)

# Log sync activity to relay
if [ "$SYNCED" -gt 0 ] || [ "$TOTAL" -gt 0 ]; then
  ACTIVITY_PAYLOAD=$(python3 -c "
import json, sys
print(json.dumps({
    'type': 'system',
    'title': 'Cron sync complete',
    'description': f'{sys.argv[1]}/{sys.argv[2]} cron jobs synced ({sys.argv[3]} errors)',
    'status': 'error' if int(sys.argv[3]) > 0 else 'success',
    'timestamp': int(__import__('time').time() * 1000)
}))
" "$SYNCED" "$TOTAL" "$ERRORS")

  curl -s -f -X POST "$RELAY_URL" \
    -H "Content-Type: application/json" \
    -d "$ACTIVITY_PAYLOAD" \
    -o /dev/null 2>/dev/null || true
fi
