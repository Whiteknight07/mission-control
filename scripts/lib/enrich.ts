export type ActivityType = "email" | "code" | "cron" | "search" | "message" | "file" | "browser" | "system";
export type ActivityStatus = "success" | "error" | "pending";

export interface ConvexActivity {
  type: ActivityType;
  title: string;
  description?: string;
  status: ActivityStatus;
  metadata?: Record<string, unknown>;
  timestamp?: number;
}

export type ToolKind =
  | "exec"
  | "message"
  | "file_read"
  | "file_modify"
  | "browser"
  | "cron"
  | "web_fetch"
  | "sessions_spawn"
  | "unknown";

export interface RawToolCall {
  tool: string;
  params: Record<string, unknown>;
  result?: Record<string, unknown>;
  duration?: number;
  sessionKey?: string;
  timestamp?: number;
}

export interface EnrichToolCallInput {
  tool: string;
  title?: string;
  description?: string;
  status?: ActivityStatus;
  metadata?: Record<string, unknown>;
  arguments?: unknown;
  result?: unknown;
  timestamp?: number;
}

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

function extractDomain(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname;
  } catch {
    return rawUrl;
  }
}

function extractPath(params: Record<string, unknown>): string | undefined {
  return getString(params, "path", "filePath", "filepath", "file", "filename", "target", "source", "uri");
}

function inferStatusFromResult(result?: Record<string, unknown>): ActivityStatus {
  if (!result) {
    return "success";
  }

  const explicitStatus = getString(result, "status");
  if (explicitStatus === "error" || explicitStatus === "pending" || explicitStatus === "success") {
    return explicitStatus;
  }

  if (result.error || result.errorMessage || result.isError === true) {
    return "error";
  }

  if (result.ok === false || result.success === false) {
    return "error";
  }

  const exitCode = getNumber(result, "exitCode", "code");
  if (typeof exitCode === "number" && exitCode !== 0) {
    return "error";
  }

  const details = result.details;
  if (isRecord(details)) {
    return inferStatusFromResult(details);
  }

  return "success";
}

export function classifyTool(tool: string): ToolKind {
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

  if (/(^|_)(read|cat|view|open)(_)?file/.test(normalized) || normalized.includes("readfile") || normalized === "read") {
    return "file_read";
  }

  if (
    /(^|_)(write|edit|patch|modify|update|save)(_)?file/.test(normalized) ||
    normalized.includes("apply_patch") ||
    normalized.includes("writefile") ||
    normalized === "write" ||
    normalized === "edit"
  ) {
    return "file_modify";
  }

  return "unknown";
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

export function toolToActivityType(tool: string): ActivityType {
  return inferActivityType(classifyTool(tool));
}

function coerceResultRecord(result: unknown): Record<string, unknown> | undefined {
  if (isRecord(result)) {
    return result;
  }
  return undefined;
}

function coerceParamsRecord(args: unknown): Record<string, unknown> {
  if (isRecord(args)) {
    return args;
  }
  return {};
}

export function enrichRawToolCall(toolCall: RawToolCall): { activity: ConvexActivity; kind: ToolKind; filePath?: string } {
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
  const metadata: Record<string, unknown> = {
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

export function enrichToolCallActivity(input: EnrichToolCallInput): ConvexActivity {
  const params = coerceParamsRecord(input.arguments);
  const result = coerceResultRecord(input.result);
  const enriched = enrichRawToolCall({
    tool: input.tool,
    params,
    result,
    timestamp: input.timestamp,
  });

  const metadata: Record<string, unknown> = {
    ...(enriched.activity.metadata ?? {}),
    ...(input.metadata ?? {}),
    tool: input.tool,
  };

  return {
    ...enriched.activity,
    title: input.title?.trim() || enriched.activity.title,
    description: input.description?.trim() || enriched.activity.description,
    status: input.status ?? enriched.activity.status,
    metadata,
    timestamp: input.timestamp ?? enriched.activity.timestamp,
  };
}

export function buildActivityDedupKey(timestamp: number, tool: string | undefined, title: string): string {
  return `${timestamp}|${(tool ?? "").trim().toLowerCase()}|${title.trim()}`;
}
