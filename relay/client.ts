const RELAY_URL = "http://127.0.0.1:3002/events";
const CONVEX_ENDPOINT = "https://careful-gnat-191.convex.site/activity/log";

type EventType = "tool_call" | "cron_fire" | "message_sent" | "file_changed" | "error";
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

/**
 * Log an activity via the local relay server
 */
export async function logActivity(event: RelayEvent): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const response = await fetch(RELAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
    return await response.json() as { ok: boolean; id?: string; error?: string };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/**
 * Log directly to Convex, bypassing the relay
 */
export async function logDirect(activity: ConvexActivity): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const response = await fetch(CONVEX_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...activity,
        timestamp: activity.timestamp || Date.now(),
      }),
    });
    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }
    return await response.json() as { ok: boolean; id?: string };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

// CLI mode
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const flags: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      flags[key] = args[i + 1] || "";
      i++;
    }
  }

  if (!flags.event || !flags.title) {
    console.log("Usage: npx tsx client.ts --event <type> --title <title> [--desc <description>] [--tool <tool>] [--status <status>]");
    console.log("\nEvent types: tool_call, cron_fire, message_sent, file_changed, error");
    console.log("Status: success, error, pending (default: success)");
    process.exit(1);
  }

  const event: RelayEvent = {
    event: flags.event as EventType,
    title: flags.title,
    description: flags.desc,
    tool: flags.tool,
    status: (flags.status as "success" | "error" | "pending") || "success",
  };

  console.log("Sending event:", event);
  logActivity(event).then((result) => {
    console.log("Result:", result);
    process.exit(result.ok ? 0 : 1);
  });
}
