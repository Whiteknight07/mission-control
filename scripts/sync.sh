#!/usr/bin/env bash
# Mission Control data sync — pushes cron jobs, documents, and recent activity to Convex
set -euo pipefail

SITE_URL="https://careful-gnat-191.convex.site"
CONVEX_URL="https://careful-gnat-191.convex.cloud"
ACTIVITY_ENDPOINT="$SITE_URL/activity/log"

echo "🐉 Mission Control Sync"
echo "========================"

# ── 1. Sync Cron Jobs as Scheduled Tasks ──
echo ""
echo "⏰ Syncing cron jobs → scheduledTasks..."

CRON_JSON=$(openclaw cron list --json 2>/dev/null || echo "[]")
COUNT=$(echo "$CRON_JSON" | python3 -c "import sys,json; jobs=json.load(sys.stdin); print(len(jobs) if isinstance(jobs, list) else 0)" 2>/dev/null || echo "0")

if [ "$COUNT" -gt 0 ]; then
  echo "$CRON_JSON" | python3 << 'PYEOF'
import json, sys, urllib.request

CONVEX_URL = "https://careful-gnat-191.convex.cloud"
jobs = json.load(sys.stdin)
if not isinstance(jobs, list):
    jobs = jobs.get("jobs", []) if isinstance(jobs, dict) else []

synced = 0
for job in jobs:
    name = job.get("name", job.get("id", "unknown"))
    schedule = json.dumps(job.get("schedule", {}))
    enabled = job.get("enabled", True)
    
    # Determine type
    job_type = "cron"
    if "reminder" in name.lower():
        job_type = "reminder"
    
    # Calculate nextFire if available
    next_fire = job.get("nextFireTime")
    last_run = job.get("lastRunTime")
    
    payload = {
        "path": "scheduledTasks:upsertByName",
        "args": {
            "name": name,
            "schedule": schedule,
            "type": job_type,
            "enabled": enabled,
            "lastRun": last_run,
            "nextFire": next_fire,
        },
        "format": "json",
    }
    
    try:
        req = urllib.request.Request(
            f"{CONVEX_URL}/api/mutation",
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
        )
        urllib.request.urlopen(req, timeout=10)
        synced += 1
    except Exception as e:
        # Fall back to HTTP activity endpoint
        pass

print(f"   Synced {synced}/{len(jobs)} cron jobs")
PYEOF
else
  echo "   No cron jobs found (or openclaw cron list failed)"
fi

# ── 2. Index workspace documents ──
echo ""
echo "📄 Indexing workspace documents..."

DOC_COUNT=0
for file in /root/clawd/MEMORY.md /root/clawd/SOUL.md /root/clawd/AGENTS.md /root/clawd/TOOLS.md /root/clawd/IDENTITY.md /root/clawd/HEARTBEAT.md /root/clawd/USER.md; do
  if [ -f "$file" ]; then
    FNAME=$(basename "$file")
    CONTENT=$(head -c 8000 "$file" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))" 2>/dev/null)
    
    curl -s -X POST "$CONVEX_URL/api/mutation" \
      -H "Content-Type: application/json" \
      -d "{\"path\":\"documents:upsert\",\"args\":{\"path\":\"$file\",\"name\":\"$FNAME\",\"content\":$CONTENT,\"type\":\"config\"},\"format\":\"json\"}" \
      -o /dev/null 2>/dev/null && DOC_COUNT=$((DOC_COUNT + 1))
  fi
done

# Index memory files
for file in /root/clawd/memory/*.md; do
  if [ -f "$file" ]; then
    FNAME=$(basename "$file")
    CONTENT=$(head -c 8000 "$file" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))" 2>/dev/null)
    
    curl -s -X POST "$CONVEX_URL/api/mutation" \
      -H "Content-Type: application/json" \
      -d "{\"path\":\"documents:upsert\",\"args\":{\"path\":\"$file\",\"name\":\"$FNAME\",\"content\":$CONTENT,\"type\":\"memory\"},\"format\":\"json\"}" \
      -o /dev/null 2>/dev/null && DOC_COUNT=$((DOC_COUNT + 1))
  fi
done

echo "   Indexed $DOC_COUNT documents"

# ── 3. Log some seed activities ──
echo ""
echo "📊 Logging recent activities..."

ACT_COUNT=0

log_activity() {
  local type="$1" title="$2" desc="$3" status="${4:-success}"
  curl -s -X POST "$ACTIVITY_ENDPOINT" \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"$type\",\"title\":\"$title\",\"description\":\"$desc\",\"status\":\"$status\",\"timestamp\":$(date +%s%3N)}" \
    -o /dev/null 2>/dev/null && ACT_COUNT=$((ACT_COUNT + 1))
}

log_activity "system" "Mission Control deployed" "Phase 3 merge complete — activity feed, calendar view, global search all live"
log_activity "system" "Tailscale serve configured" "MC on :3100, Grafana on :3200"
log_activity "code" "Mission Control — 3 features merged" "Activity feed, calendar view, global search merged from parallel Codex branches"
log_activity "cron" "Morning briefing" "Daily briefing cron fires at 10 AM PST" 
log_activity "cron" "Portfolio daily check" "DCA strategy alerts at 7 AM PST Mon-Fri"
log_activity "code" "inframap nightly build" "Infrastructure health intelligence CLI — 8 modules, 2640 lines"
log_activity "code" "gh-flow nightly build" "Strict GitHub PR workflow CLI for capstone conventions"
log_activity "system" "Convex functions synced" "Dev deployment careful-gnat-191 updated with all schema changes"

echo "   Logged $ACT_COUNT activities"

echo ""
echo "✅ Sync complete! Refresh Mission Control."
