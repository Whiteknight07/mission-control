# Mission Control Webhook Relay

Lightweight webhook relay between OpenClaw and the Mission Control Convex backend.

## Quick Start

```bash
# Install dependencies
cd relay && npm install

# Start the server
npm start

# Or with PM2
pm2 start ecosystem.config.cjs
```

## Architecture

```
OpenClaw → webhook/script → POST localhost:3002/events → Relay → Convex
```

The relay server:
- Listens on `http://127.0.0.1:3002`
- Translates OpenClaw events to Mission Control activity format
- Forwards to `https://careful-gnat-191.convex.site/activity/log`
- Rate limits (1 event/sec per type) and deduplicates (30s window)

## API

### POST /events

```json
{
  "event": "tool_call",
  "tool": "exec",
  "title": "Ran shell command",
  "description": "git push origin main",
  "status": "success",
  "metadata": {}
}
```

**Event types:** `tool_call`, `cron_fire`, `message_sent`, `file_changed`, `error`

**Status:** `success`, `error`, `pending`

### GET /health

Returns `{ "status": "ok", "port": 3002 }`

## Client Library

```typescript
import { logActivity, logDirect } from "./client.ts";

// Via relay (with rate limiting/dedup)
await logActivity({
  event: "tool_call",
  tool: "exec",
  title: "Built project",
  status: "success"
});

// Direct to Convex (bypasses relay)
await logDirect({
  type: "code",
  title: "Built project",
  status: "success"
});
```

### CLI

```bash
npx tsx client.ts --event tool_call --title "Ran build" --desc "npm run build"
```

## Shell Hook

For OpenClaw integration:

```bash
# With arguments
./openclaw-hook.sh --event cron_fire --title "Morning Briefing" --status success

# With stdin
echo '{"event":"tool_call","title":"Test"}' | ./openclaw-hook.sh --stdin

# Direct curl
curl -X POST http://localhost:3002/events \
  -H "Content-Type: application/json" \
  -d '{"event":"cron_fire","title":"Daily Sync","status":"success"}'
```

## PM2

```bash
# Start
pm2 start ecosystem.config.cjs

# Monitor
pm2 logs mc-relay

# Stop
pm2 stop mc-relay
```
