#!/usr/bin/env bash
# Sync OpenClaw cron jobs → Convex scheduledTasks (calendar view)
# Run periodically or on-demand: bash scripts/sync-crons.sh
set -euo pipefail

CONVEX_URL="https://careful-gnat-191.convex.cloud"

echo "⏰ Syncing OpenClaw crons → Mission Control calendar..."

# Get cron list as JSON
# openclaw outputs log prefixes before JSON — extract only the JSON part
CRON_RAW=$(openclaw cron list --json 2>/dev/null || echo "{}")
CRON_JSON=$(echo "$CRON_RAW" | sed -n '/^{/,$ p')

export MC_CONVEX_URL="$CONVEX_URL"
export MC_CRON_JSON="$CRON_JSON"

python3 << 'PYEOF'
import json, os, sys, urllib.request

CONVEX_URL = os.environ["MC_CONVEX_URL"]
raw = os.environ["MC_CRON_JSON"]

try:
    data = json.loads(raw)
except:
    print("  ❌ Failed to parse cron list JSON")
    sys.exit(1)

jobs = data if isinstance(data, list) else data.get("jobs", [])
if not jobs:
    print("  No cron jobs found")
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
        print(f"  ✅ {name} ({action})")
    except Exception as e:
        errors += 1
        print(f"  ❌ {name}: {e}")

print(f"\nSynced {synced}/{len(jobs)} jobs ({errors} errors)")
PYEOF
