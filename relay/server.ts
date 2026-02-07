import express, { Request, Response } from "express";

const PORT = 3002;
const CONVEX_ENDPOINT = "https://careful-gnat-191.convex.site/activity/log";

// Event types from OpenClaw
type EventType = "tool_call" | "cron_fire" | "message_sent" | "file_changed" | "error";

// Activity types for Mission Control
type ActivityType = "email" | "code" | "cron" | "search" | "message" | "file" | "browser" | "system";

interface RelayEvent {
  event: EventType;
  tool?: string;
  title: string;
  description?: string;
  status?: "success" | "error" | "pending";
  metadata?: Record<string, unknown>;
}

interface ConvexActivity {
  type: ActivityType;
  title: string;
  description?: string;
  status: "success" | "error" | "pending";
  metadata?: Record<string, unknown>;
  timestamp?: number;
}

// Map tool names to activity types
function toolToActivityType(tool: string): ActivityType {
  const toolMap: Record<string, ActivityType> = {
    exec: "code",
    Bash: "code",
    read: "code",
    Read: "code",
    write: "code",
    Write: "code",
    Edit: "code",
    browser: "browser",
    WebFetch: "search",
    web_fetch: "search",
    message: "message",
    cron: "cron",
  };
  return toolMap[tool] || "system";
}

// Map event types to activity types
function eventToActivityType(event: RelayEvent): ActivityType {
  if (event.event === "tool_call" && event.tool) {
    return toolToActivityType(event.tool);
  }
  const eventMap: Record<EventType, ActivityType> = {
    tool_call: "system",
    cron_fire: "cron",
    message_sent: "message",
    file_changed: "file",
    error: "system",
  };
  return eventMap[event.event] || "system";
}

// Rate limiting: track last event time per type
const lastEventTime = new Map<string, number>();
const RATE_LIMIT_MS = 1000;

// Deduplication: track recent titles
const recentTitles = new Map<string, number>();
const DEDUP_WINDOW_MS = 30000;

function isRateLimited(eventType: string): boolean {
  const now = Date.now();
  const last = lastEventTime.get(eventType) || 0;
  if (now - last < RATE_LIMIT_MS) {
    return true;
  }
  lastEventTime.set(eventType, now);
  return false;
}

function isDuplicate(title: string): boolean {
  const now = Date.now();
  // Clean old entries
  for (const [t, time] of recentTitles) {
    if (now - time > DEDUP_WINDOW_MS) {
      recentTitles.delete(t);
    }
  }
  if (recentTitles.has(title)) {
    return true;
  }
  recentTitles.set(title, now);
  return false;
}

async function forwardToConvex(activity: ConvexActivity): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const response = await fetch(CONVEX_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(activity),
    });
    if (!response.ok) {
      const text = await response.text();
      console.error(`Convex error: ${response.status} ${text}`);
      return { ok: false, error: `HTTP ${response.status}` };
    }
    const data = await response.json() as { ok: boolean; id?: string };
    return data;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to forward to Convex: ${message}`);
    return { ok: false, error: message };
  }
}

const app = express();
app.use(express.json());

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", port: PORT });
});

// Main event endpoint
app.post("/events", async (req: Request, res: Response) => {
  const event = req.body as RelayEvent;

  if (!event.event || !event.title) {
    res.status(400).json({ error: "Missing required fields: event, title" });
    return;
  }

  // Rate limiting
  if (isRateLimited(event.event)) {
    res.status(429).json({ error: "Rate limited", event: event.event });
    return;
  }

  // Deduplication
  if (isDuplicate(event.title)) {
    res.status(200).json({ ok: true, deduplicated: true });
    return;
  }

  const activity: ConvexActivity = {
    type: eventToActivityType(event),
    title: event.title,
    description: event.description,
    status: event.status || "success",
    metadata: event.metadata,
    timestamp: Date.now(),
  };

  console.log(`[${new Date().toISOString()}] ${activity.type}: ${activity.title}`);

  const result = await forwardToConvex(activity);
  if (result.ok) {
    res.json({ ok: true, id: result.id, type: activity.type });
  } else {
    res.status(502).json({ ok: false, error: result.error });
  }
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`MC Webhook Relay listening on http://127.0.0.1:${PORT}`);
  console.log(`Forwarding to: ${CONVEX_ENDPOINT}`);
});
