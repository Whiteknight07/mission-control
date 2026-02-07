import path from "node:path";
import express, { Request, Response } from "express";
import { enrichRawToolCall } from "../scripts/lib/enrich.js";

const PORT = 3002;
const CONVEX_ENDPOINT = "https://careful-gnat-191.convex.site/activity/log";

type EventType = "tool_call" | "cron_fire" | "message_sent" | "file_changed" | "error";
type ActivityType = "email" | "code" | "cron" | "search" | "message" | "file" | "browser" | "system";
type ActivityStatus = "success" | "error" | "pending";

type ToolKind =
  | "exec"
  | "message"
  | "file_read"
  | "file_modify"
  | "browser"
  | "cron"
  | "web_fetch"
  | "sessions_spawn"
  | "unknown";

interface RelayEvent {
  event: EventType;
  tool?: string;
  title: string;
  description?: string;
  status?: ActivityStatus;
  metadata?: Record<string, unknown>;
}

interface RawToolCall {
  tool: string;
  params: Record<string, unknown>;
  result?: Record<string, unknown>;
  duration?: number;
  sessionKey?: string;
  timestamp?: number;
}

interface EnrichedMetadata extends Record<string, unknown> {
  importance: number;
  tool: string;
  duration?: number;
  sessionKey?: string;
}

interface ConvexActivity {
  type: ActivityType;
  title: string;
  description?: string;
  status: ActivityStatus;
  metadata: EnrichedMetadata;
  timestamp: number;
}

interface ProcessOutcome {
  accepted: boolean;
  buffered: boolean;
  forwarded: number;
  title: string;
}

interface FileReadEntry {
  activity: ConvexActivity;
  filePath: string;
}

interface FileReadBucket {
  key: string;
  directory: string;
  sessionKey: string;
  startedAt: number;
  entries: FileReadEntry[];
  timer: NodeJS.Timeout;
}

const FILE_READ_BATCH_THRESHOLD = 5;
const FILE_READ_BATCH_WINDOW_MS = 10_000;

const lastEventTime = new Map<string, number>();
const RATE_LIMIT_MS = 1000;

const recentTitles = new Map<string, number>();
const DEDUP_WINDOW_MS = 30_000;

const fileReadBuckets = new Map<string, FileReadBucket>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function getNumber(obj: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

function truncate(value: string, max = 120): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 3)}...`;
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function safeDirectory(filePath: string | undefined): string {
  if (!filePath) {
    return "workspace";
  }
  const normalized = normalizePath(filePath);
  const dir = path.posix.dirname(normalized);
  return dir === "." ? "workspace" : dir;
}

function extractDomain(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname;
  } catch {
    return rawUrl;
  }
}

function inferStatusFromResult(result?: Record<string, unknown>): ActivityStatus {
  if (!result) {
    return "success";
  }

  const explicitStatus = getString(result, "status");
  if (explicitStatus === "error" || explicitStatus === "pending" || explicitStatus === "success") {
    return explicitStatus;
  }

  if (result.error) {
    return "error";
  }

  if (result.ok === false || result.success === false) {
    return "error";
  }

  const exitCode = getNumber(result, "exitCode", "code");
  if (typeof exitCode === "number" && exitCode !== 0) {
    return "error";
  }

  return "success";
}

function classifyTool(tool: string): ToolKind {
  const normalized = tool.toLowerCase();

  if (
    normalized === "exec_command" ||
    normalized === "write_stdin" ||
    normalized.includes("exec") ||
    normalized.includes("bash") ||
    normalized.includes("shell")
  ) {
    return "exec";
  }

  if (
    normalized.includes("message") ||
    normalized.includes("discord") ||
    normalized.includes("telegram") ||
    normalized.includes("slack")
  ) {
    return "message";
  }

  if (normalized.includes("web_fetch") || normalized.includes("webfetch")) {
    return "web_fetch";
  }

  if (
    normalized.includes("browser") ||
    normalized.includes("open_url") ||
    normalized.includes("navigate") ||
    normalized.includes("click")
  ) {
    return "browser";
  }

  if (normalized.includes("cron") || normalized.includes("schedule")) {
    return "cron";
  }

  if (normalized.includes("sessions_spawn") || normalized.includes("spawn_session") || normalized.includes("subagent")) {
    return "sessions_spawn";
  }

  if (/(^|_)(read|cat|view|open)(_)?file/.test(normalized) || normalized.includes("readfile")) {
    return "file_read";
  }

  if (
    /(^|_)(write|edit|patch|modify|update|save)(_)?file/.test(normalized) ||
    normalized.includes("apply_patch") ||
    normalized.includes("writefile")
  ) {
    return "file_modify";
  }

  return "unknown";
}

function extractPath(params: Record<string, unknown>): string | undefined {
  return getString(params, "path", "filePath", "filepath", "file", "filename", "target", "source", "uri");
}

function summarizeExecCommand(command: string): { title: string; description?: string } {
  const normalized = command.trim();
  const lower = normalized.toLowerCase();

  if (/^git\s+push\b/.test(lower)) {
    return { title: "Pushed code to GitHub", description: `Command: ${normalized}` };
  }

  if (/^git\s+pull\b/.test(lower)) {
    return { title: "Pulled latest code changes", description: `Command: ${normalized}` };
  }

  if (/^git\s+commit\b/.test(lower)) {
    return { title: "Committed code changes", description: `Command: ${normalized}` };
  }

  if (/^(npm|pnpm|yarn)\s+install\b/.test(lower)) {
    return { title: "Installed project dependencies", description: `Command: ${normalized}` };
  }

  if (/^(npm|pnpm|yarn)\s+(test|run\s+test)\b/.test(lower) || /^pytest\b/.test(lower)) {
    return { title: "Ran test suite", description: `Command: ${normalized}` };
  }

  if (/^(npm|pnpm|yarn)\s+(run\s+)?build\b/.test(lower)) {
    return { title: "Built project", description: `Command: ${normalized}` };
  }

  return { title: `Ran command: ${truncate(normalized, 90)}` };
}

function inferImportance(kind: ToolKind, status: ActivityStatus): number {
  if (status === "error") {
    return 5;
  }
  if (kind === "file_read") {
    return 1;
  }
  if (kind === "message") {
    return 4;
  }
  if (kind === "exec" || kind === "sessions_spawn") {
    return 3;
  }
  return 2;
}

function inferActivityType(kind: ToolKind): ActivityType {
  switch (kind) {
    case "exec":
      return "code";
    case "message":
      return "message";
    case "file_read":
    case "file_modify":
      return "file";
    case "browser":
      return "browser";
    case "cron":
      return "cron";
    case "web_fetch":
      return "search";
    case "sessions_spawn":
      return "system";
    default:
      return "system";
  }
}

function enrichToolCall(toolCall: RawToolCall): { activity: ConvexActivity; kind: ToolKind; filePath?: string } {
  const kind = classifyTool(toolCall.tool);
  const status = inferStatusFromResult(toolCall.result);
  const params = toolCall.params;

  let title = `Ran tool: ${toolCall.tool}`;
  let description: string | undefined;
  const filePath = extractPath(params);

  if (kind === "exec") {
    const command = getString(params, "cmd", "command", "script", "chars", "input");
    if (command) {
      const summary = summarizeExecCommand(command);
      title = summary.title;
      description = summary.description;
    } else {
      title = "Executed command";
    }
  } else if (kind === "message") {
    const platformFromTool = toolCall.tool.toLowerCase().includes("discord")
      ? "Discord"
      : toolCall.tool.toLowerCase().includes("telegram")
        ? "Telegram"
        : toolCall.tool.toLowerCase().includes("slack")
          ? "Slack"
          : undefined;
    const platform = getString(params, "platform", "provider", "service") ?? platformFromTool;
    const channel = getString(params, "channel", "chat", "chatId", "room", "thread");
    const normalizedPlatform = platform ? platform.charAt(0).toUpperCase() + platform.slice(1) : "destination";
    title = channel
      ? `Sent message to ${normalizedPlatform} (${channel})`
      : `Sent message to ${normalizedPlatform}`;
    const preview = getString(params, "text", "content", "message");
    if (preview) {
      description = `Message preview: ${truncate(preview, 140)}`;
    }
  } else if (kind === "file_read") {
    title = `Read file: ${filePath ?? "unknown"}`;
    description = filePath ? `Opened ${filePath}` : "Read file contents";
  } else if (kind === "file_modify") {
    title = `Modified file: ${filePath ?? "unknown"}`;
    description = filePath ? `Updated ${filePath}` : "Modified file contents";
  } else if (kind === "browser") {
    const url = getString(params, "url", "href");
    const action = getString(params, "action", "command", "operation");
    title = `Browsed: ${url ?? action ?? "browser action"}`;
    description = action && url ? `Action: ${action}` : undefined;
  } else if (kind === "cron") {
    const taskName = getString(params, "name", "job", "task", "id") ?? "unnamed";
    const action = getString(params, "action", "operation")?.toLowerCase() ?? "schedule";
    if (action.includes("update") || action.includes("edit")) {
      title = `Updated cron job: ${taskName}`;
    } else {
      title = `Scheduled cron job: ${taskName}`;
    }
    const schedule = getString(params, "schedule", "cron", "expression");
    if (schedule) {
      description = `Schedule: ${schedule}`;
    }
  } else if (kind === "web_fetch") {
    const url = getString(params, "url", "href", "target") ?? "unknown";
    title = `Fetched webpage: ${extractDomain(url)}`;
    description = `URL: ${url}`;
  } else if (kind === "sessions_spawn") {
    const summary = getString(params, "task", "summary", "prompt", "description") ?? "unspecified task";
    title = `Spawned sub-agent: ${truncate(summary, 90)}`;
  }

  const importance = inferImportance(kind, status);
  const metadata: EnrichedMetadata = {
    importance,
    tool: toolCall.tool,
  };

  if (typeof toolCall.duration === "number" && Number.isFinite(toolCall.duration)) {
    metadata.duration = toolCall.duration;
  }

  if (toolCall.sessionKey) {
    metadata.sessionKey = toolCall.sessionKey;
  }

  const activity: ConvexActivity = {
    type: inferActivityType(kind),
    title,
    description,
    status,
    metadata,
    timestamp: typeof toolCall.timestamp === "number" && Number.isFinite(toolCall.timestamp)
      ? toolCall.timestamp
      : Date.now(),
  };

  return { activity, kind, filePath };
}

function toolToActivityType(tool: string): ActivityType {
  return inferActivityType(classifyTool(tool));
}

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

function isRateLimited(eventType: string): boolean {
  const now = Date.now();
  const last = lastEventTime.get(eventType) ?? 0;
  if (now - last < RATE_LIMIT_MS) {
    return true;
  }
  lastEventTime.set(eventType, now);
  return false;
}

function isDuplicate(title: string): boolean {
  const now = Date.now();
  for (const [recentTitle, time] of recentTitles) {
    if (now - time > DEDUP_WINDOW_MS) {
      recentTitles.delete(recentTitle);
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

    const bodyText = await response.text();
    if (!bodyText) {
      return { ok: true };
    }

    try {
      const data = JSON.parse(bodyText) as { ok?: boolean; id?: string };
      return { ok: data.ok ?? true, id: data.id };
    } catch {
      return { ok: true };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to forward to Convex: ${message}`);
    return { ok: false, error: message };
  }
}

async function flushFileReadBucket(key: string): Promise<number> {
  const bucket = fileReadBuckets.get(key);
  if (!bucket) {
    return 0;
  }

  clearTimeout(bucket.timer);
  fileReadBuckets.delete(key);

  if (bucket.entries.length >= FILE_READ_BATCH_THRESHOLD) {
    const latest = bucket.entries[bucket.entries.length - 1];
    const hasError = bucket.entries.some((entry) => entry.activity.status === "error");
    const status: ActivityStatus = hasError ? "error" : "success";
    const importance = status === "error" ? 5 : 1;

    const activity: ConvexActivity = {
      type: "file",
      title: `Read ${bucket.entries.length} files in ${bucket.directory}`,
      description: `Collapsed ${bucket.entries.length} file reads within 10 seconds`,
      status,
      timestamp: latest.activity.timestamp,
      metadata: {
        importance,
        tool: "file_read_batch",
        sessionKey: bucket.sessionKey,
        fileCount: bucket.entries.length,
        directory: bucket.directory,
      },
    };

    await forwardToConvex(activity);
    console.log(`[${new Date().toISOString()}] ${activity.type}: ${activity.title}`);
    return 1;
  }

  let forwarded = 0;
  for (const entry of bucket.entries) {
    await forwardToConvex(entry.activity);
    console.log(`[${new Date().toISOString()}] ${entry.activity.type}: ${entry.activity.title}`);
    forwarded += 1;
  }

  return forwarded;
}

async function flushAllFileReadBuckets(): Promise<void> {
  const keys = [...fileReadBuckets.keys()];
  for (const key of keys) {
    await flushFileReadBucket(key);
  }
}

async function queueOrForwardToolActivity(
  activity: ConvexActivity,
  kind: ToolKind,
  filePath: string | undefined,
): Promise<ProcessOutcome> {
  if (kind !== "file_read") {
    const result = await forwardToConvex(activity);
    if (!result.ok) {
      return { accepted: false, buffered: false, forwarded: 0, title: activity.title };
    }
    console.log(`[${new Date().toISOString()}] ${activity.type}: ${activity.title}`);
    return { accepted: true, buffered: false, forwarded: 1, title: activity.title };
  }

  const sessionKey = activity.metadata.sessionKey ?? "global";
  const directory = safeDirectory(filePath);
  const bucketKey = `${sessionKey}:${directory}`;
  const now = Date.now();
  const entry: FileReadEntry = { activity, filePath: filePath ?? "unknown" };

  const existingBucket = fileReadBuckets.get(bucketKey);
  if (existingBucket && now - existingBucket.startedAt > FILE_READ_BATCH_WINDOW_MS) {
    await flushFileReadBucket(bucketKey);
  }

  const currentBucket = fileReadBuckets.get(bucketKey);
  if (currentBucket) {
    currentBucket.entries.push(entry);
  } else {
    const timer = setTimeout(() => {
      void flushFileReadBucket(bucketKey);
    }, FILE_READ_BATCH_WINDOW_MS);

    fileReadBuckets.set(bucketKey, {
      key: bucketKey,
      directory,
      sessionKey,
      startedAt: now,
      entries: [entry],
      timer,
    });
  }

  return { accepted: true, buffered: true, forwarded: 0, title: activity.title };
}

function parseToolCall(payload: unknown): { ok: true; value: RawToolCall } | { ok: false; error: string } {
  if (!isRecord(payload)) {
    return { ok: false, error: "Payload must be an object" };
  }

  const tool = getString(payload, "tool");
  if (!tool) {
    return { ok: false, error: "Missing required field: tool" };
  }

  const paramsRaw = payload.params;
  if (!isRecord(paramsRaw)) {
    return { ok: false, error: "Missing required field: params (object)" };
  }

  const resultRaw = payload.result;
  const timestampRaw = payload.timestamp;
  const durationRaw = payload.duration;
  const sessionKey = getString(payload, "sessionKey");

  const toolCall: RawToolCall = {
    tool,
    params: paramsRaw,
  };

  if (isRecord(resultRaw)) {
    toolCall.result = resultRaw;
  }

  if (typeof durationRaw === "number" && Number.isFinite(durationRaw)) {
    toolCall.duration = durationRaw;
  }

  if (typeof timestampRaw === "number" && Number.isFinite(timestampRaw)) {
    toolCall.timestamp = timestampRaw;
  }

  if (sessionKey) {
    toolCall.sessionKey = sessionKey;
  }

  return { ok: true, value: toolCall };
}

async function processToolCall(toolCall: RawToolCall): Promise<ProcessOutcome> {
  const { activity: sharedActivity, kind, filePath } = enrichRawToolCall(toolCall);
  const activity: ConvexActivity = {
    ...sharedActivity,
    metadata: (sharedActivity.metadata as EnrichedMetadata) ?? {
      importance: sharedActivity.status === "error" ? 5 : 2,
      tool: toolCall.tool,
    },
    timestamp: sharedActivity.timestamp ?? Date.now(),
  };
  return queueOrForwardToolActivity(activity, kind, filePath);
}

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", port: PORT, queuedFileReadBuckets: fileReadBuckets.size });
});

app.post("/events", async (req: Request, res: Response) => {
  const event = req.body as RelayEvent;

  if (!event.event || !event.title) {
    res.status(400).json({ error: "Missing required fields: event, title" });
    return;
  }

  if (isRateLimited(event.event)) {
    res.status(429).json({ error: "Rate limited", event: event.event });
    return;
  }

  if (isDuplicate(event.title)) {
    res.status(200).json({ ok: true, deduplicated: true });
    return;
  }

  const status = event.status ?? "success";
  const baseMetadata = isRecord(event.metadata) ? event.metadata : {};
  const importance = status === "error" ? 5 : 2;

  const activity: ConvexActivity = {
    type: eventToActivityType(event),
    title: event.title,
    description: event.description,
    status,
    metadata: {
      ...baseMetadata,
      importance,
      tool: event.tool ?? event.event,
      duration: typeof baseMetadata.duration === "number" ? (baseMetadata.duration as number) : undefined,
      sessionKey: getString(baseMetadata, "sessionKey"),
    },
    timestamp: Date.now(),
  };

  console.log(`[${new Date().toISOString()}] ${activity.type}: ${activity.title}`);

  const result = await forwardToConvex(activity);
  if (result.ok) {
    res.json({ ok: true, id: result.id, type: activity.type });
    return;
  }

  res.status(502).json({ ok: false, error: result.error });
});

app.post("/tools", async (req: Request, res: Response) => {
  const parsed = parseToolCall(req.body);
  if (!parsed.ok) {
    res.status(400).json({ ok: false, error: parsed.error });
    return;
  }

  const outcome = await processToolCall(parsed.value);
  if (!outcome.accepted) {
    res.status(502).json({ ok: false, error: "Failed to forward activity" });
    return;
  }

  res.status(202).json({
    ok: true,
    buffered: outcome.buffered,
    forwarded: outcome.forwarded,
    title: outcome.title,
  });
});

app.post("/batch", async (req: Request, res: Response) => {
  const payload = req.body;
  if (!Array.isArray(payload)) {
    res.status(400).json({ ok: false, error: "Payload must be an array of tool calls" });
    return;
  }

  let accepted = 0;
  let buffered = 0;
  let forwarded = 0;
  const errors: Array<{ index: number; error: string }> = [];

  for (let index = 0; index < payload.length; index += 1) {
    const parsed = parseToolCall(payload[index]);
    if (!parsed.ok) {
      errors.push({ index, error: parsed.error });
      continue;
    }

    const outcome = await processToolCall(parsed.value);
    if (!outcome.accepted) {
      errors.push({ index, error: "Failed to forward activity" });
      continue;
    }

    accepted += 1;
    if (outcome.buffered) {
      buffered += 1;
    }
    forwarded += outcome.forwarded;
  }

  const statusCode = errors.length > 0 ? 207 : 202;
  res.status(statusCode).json({
    ok: errors.length === 0,
    accepted,
    buffered,
    forwarded,
    errors,
  });
});

process.on("SIGINT", () => {
  void flushAllFileReadBuckets().finally(() => process.exit(0));
});

process.on("SIGTERM", () => {
  void flushAllFileReadBuckets().finally(() => process.exit(0));
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`MC Webhook Relay listening on http://127.0.0.1:${PORT}`);
  console.log(`Forwarding to: ${CONVEX_ENDPOINT}`);
});
