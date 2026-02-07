#!/usr/bin/env -S npx tsx

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { ConvexHttpClient } from "convex/browser";

import { api } from "../convex/_generated/api";
import { buildActivityDedupKey, enrichRawToolCall, type ConvexActivity, type RawToolCall } from "./lib/enrich";

const CONVEX_SITE_ENDPOINT = "https://careful-gnat-191.convex.site/activity/log";
const CONVEX_CLOUD_URL = process.env.MC_CONVEX_URL ?? "https://careful-gnat-191.convex.cloud";
const STATE_PATH = path.resolve(process.cwd(), "scripts/.backfill-state.json");
const MAX_SCAN_DEPTH = 6;

interface CliOptions {
  dir?: string;
  sinceMs?: number;
  dryRun: boolean;
  cron: boolean;
}

interface FileState {
  lineOffset: number;
  lastTimestamp?: number;
  updatedAt: number;
}

interface BackfillState {
  version: 1;
  files: Record<string, FileState>;
}

interface PendingToolCall {
  tool: string;
  params: Record<string, unknown>;
  timestamp: number;
}

interface ProcessStats {
  sent: number;
  dryRun: number;
  skippedSince: number;
  skippedDuplicateRun: number;
  skippedDuplicateConvex: number;
  parseErrors: number;
  postErrors: number;
}

interface ProcessFileResult {
  halted: boolean;
  nextOffset: number;
  maxTimestamp?: number;
  stats: ProcessStats;
}

function createLogger(silent: boolean) {
  return {
    info: (...args: unknown[]) => {
      if (!silent) {
        console.log(...args);
      }
    },
    error: (...args: unknown[]) => {
      console.error(...args);
    },
  };
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    dryRun: false,
    cron: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--cron") {
      options.cron = true;
      continue;
    }

    if (arg === "--dir") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("--dir requires a path value");
      }
      options.dir = path.resolve(value);
      i += 1;
      continue;
    }

    if (arg === "--since") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("--since requires an ISO date");
      }

      const parsed = Date.parse(value);
      if (!Number.isFinite(parsed)) {
        throw new Error(`Invalid --since value: ${value}`);
      }

      options.sinceMs = parsed;
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function defaultTranscriptDirs(): string[] {
  const home = os.homedir();
  return [
    path.join(home, ".openclaw/store"),
    path.join(home, ".openclaw/agents"),
    path.join(home, ".openclaw/agents/main/sessions"),
    path.join(home, ".codex/sessions"),
  ];
}

function isTranscriptFile(filePath: string): boolean {
  const base = path.basename(filePath);
  return base.endsWith(".jsonl") && !base.endsWith(".jsonl.lock") && !base.includes(".deleted.");
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function collectTranscriptFiles(rootPath: string): Promise<string[]> {
  const resolved = path.resolve(rootPath);
  if (!await pathExists(resolved)) {
    return [];
  }

  const stat = await fs.stat(resolved);
  if (stat.isFile()) {
    return isTranscriptFile(resolved) ? [resolved] : [];
  }

  const files: string[] = [];
  const stack: Array<{ dir: string; depth: number }> = [{ dir: resolved, depth: 0 }];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    const entries = await fs.readdir(current.dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current.dir, entry.name);
      if (entry.isFile()) {
        if (isTranscriptFile(fullPath)) {
          files.push(fullPath);
        }
        continue;
      }

      if (entry.isDirectory() && current.depth < MAX_SCAN_DEPTH) {
        stack.push({ dir: fullPath, depth: current.depth + 1 });
      }
    }
  }

  return files;
}

async function sortedTranscriptFiles(roots: string[]): Promise<string[]> {
  const allFiles: string[] = [];
  for (const root of roots) {
    const files = await collectTranscriptFiles(root);
    allFiles.push(...files);
  }

  const uniqueFiles = [...new Set(allFiles)];
  const stats = await Promise.all(uniqueFiles.map(async (filePath) => ({
    filePath,
    mtimeMs: (await fs.stat(filePath)).mtimeMs,
  })));

  stats.sort((a, b) => a.mtimeMs - b.mtimeMs);
  return stats.map((item) => item.filePath);
}

function defaultState(): BackfillState {
  return { version: 1, files: {} };
}

async function loadState(filePath: string): Promise<BackfillState> {
  try {
    const text = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(text) as Partial<BackfillState>;

    if (parsed.version !== 1 || typeof parsed.files !== "object" || parsed.files === null) {
      return defaultState();
    }

    const files: Record<string, FileState> = {};
    for (const [entryPath, entryValue] of Object.entries(parsed.files)) {
      if (typeof entryValue !== "object" || entryValue === null) {
        continue;
      }

      const lineOffsetRaw = (entryValue as { lineOffset?: unknown }).lineOffset;
      const lastTimestampRaw = (entryValue as { lastTimestamp?: unknown }).lastTimestamp;
      const updatedAtRaw = (entryValue as { updatedAt?: unknown }).updatedAt;

      const lineOffset = typeof lineOffsetRaw === "number" && Number.isFinite(lineOffsetRaw) && lineOffsetRaw >= 0
        ? Math.floor(lineOffsetRaw)
        : 0;
      const lastTimestamp = typeof lastTimestampRaw === "number" && Number.isFinite(lastTimestampRaw)
        ? lastTimestampRaw
        : undefined;
      const updatedAt = typeof updatedAtRaw === "number" && Number.isFinite(updatedAtRaw)
        ? updatedAtRaw
        : Date.now();

      files[entryPath] = { lineOffset, lastTimestamp, updatedAt };
    }

    return { version: 1, files };
  } catch {
    return defaultState();
  }
}

async function saveState(filePath: string, state: BackfillState): Promise<void> {
  const content = `${JSON.stringify(state, null, 2)}\n`;
  await fs.writeFile(filePath, content, "utf8");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return undefined;
}

function toTimestampMs(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function entryTimestamp(line: Record<string, unknown>): number | undefined {
  const message = isRecord(line.message) ? line.message : undefined;
  return toTimestampMs(message?.timestamp) ?? toTimestampMs(line.timestamp);
}

function firstText(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      if (isRecord(item)) {
        const text = getString(item, "text");
        if (text) {
          return text;
        }
      } else if (typeof item === "string") {
        return item;
      }
    }
  }
  return undefined;
}

function parseJsonRecord(value: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function extractToolCalls(line: Record<string, unknown>, timestamp: number): Array<{ id: string; call: PendingToolCall }> {
  if (line.type !== "message" || !isRecord(line.message)) {
    return [];
  }

  const message = line.message;
  if (message.role !== "assistant") {
    return [];
  }

  const content = Array.isArray(message.content) ? message.content : [];
  const calls: Array<{ id: string; call: PendingToolCall }> = [];

  for (const block of content) {
    if (!isRecord(block)) {
      continue;
    }

    const blockType = getString(block, "type");
    if (blockType !== "toolCall" && blockType !== "tool_use") {
      continue;
    }

    const id = getString(block, "id", "tool_use_id");
    const tool = getString(block, "name", "tool", "toolName");
    if (!id || !tool) {
      continue;
    }

    const params = isRecord(block.arguments)
      ? block.arguments
      : isRecord(block.input)
        ? block.input
        : {};

    calls.push({
      id,
      call: {
        tool,
        params,
        timestamp,
      },
    });
  }

  return calls;
}

function extractToolResults(line: Record<string, unknown>, timestamp: number): Array<{
  toolCallId: string;
  toolName?: string;
  result?: Record<string, unknown>;
  timestamp: number;
}> {
  if (line.type !== "message" || !isRecord(line.message)) {
    return [];
  }

  const message = line.message;
  const results: Array<{
    toolCallId: string;
    toolName?: string;
    result?: Record<string, unknown>;
    timestamp: number;
  }> = [];

  if (message.role === "toolResult") {
    const toolCallId = getString(message, "toolCallId", "tool_use_id", "toolUseId");
    if (!toolCallId) {
      return [];
    }

    const toolName = getString(message, "toolName", "tool");
    const details = isRecord(message.details)
      ? message.details
      : parseJsonRecord(firstText(message.content) ?? "");

    const result = details ?? {};
    if (!result.status && typeof message.isError === "boolean") {
      result.status = message.isError ? "error" : "success";
    }
    if (!result.tool && toolName) {
      result.tool = toolName;
    }

    results.push({ toolCallId, toolName, result, timestamp });
    return results;
  }

  const content = Array.isArray(message.content) ? message.content : [];
  for (const block of content) {
    if (!isRecord(block) || block.type !== "tool_result") {
      continue;
    }

    const toolCallId = getString(block, "tool_use_id", "toolCallId", "toolUseId");
    if (!toolCallId) {
      continue;
    }

    const toolName = getString(block, "name", "tool", "toolName");
    const blockContent = block.content;
    const result = isRecord(blockContent)
      ? blockContent
      : parseJsonRecord(firstText(blockContent) ?? "");

    results.push({ toolCallId, toolName, result: result ?? {}, timestamp });
  }

  return results;
}

function activityTool(activity: ConvexActivity): string | undefined {
  if (!isRecord(activity.metadata)) {
    return undefined;
  }
  const tool = activity.metadata.tool;
  return typeof tool === "string" ? tool : undefined;
}

function keyFromActivity(activity: ConvexActivity): string {
  const timestamp = activity.timestamp ?? Date.now();
  return buildActivityDedupKey(timestamp, activityTool(activity), activity.title);
}

function dayStart(timestamp: number): number {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

class ConvexDedupe {
  private readonly client: ConvexHttpClient;
  private readonly logger: ReturnType<typeof createLogger>;
  private readonly dayCache = new Map<number, Set<string>>();
  private rangeWarningShown = false;

  constructor(client: ConvexHttpClient, logger: ReturnType<typeof createLogger>) {
    this.client = client;
    this.logger = logger;
  }

  private async loadDay(timestamp: number): Promise<Set<string>> {
    const start = dayStart(timestamp);
    const cached = this.dayCache.get(start);
    if (cached) {
      return cached;
    }

    const end = start + (24 * 60 * 60 * 1000) - 1;
    let rows: Array<{ timestamp: number; title: string; metadata?: unknown }> = [];

    try {
      rows = await this.client.query((api as any).activities.listByTimestampRange, {
        start,
        end,
        limit: 10000,
      });
    } catch (error) {
      if (!this.rangeWarningShown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.info(`[backfill] warning: listByTimestampRange unavailable, falling back to latest-list dedupe (${message})`);
        this.rangeWarningShown = true;
      }

      rows = await this.client.query((api as any).activities.list, { limit: 5000 });
      rows = rows.filter((row) => row.timestamp >= start && row.timestamp <= end);
    }

    const keys = new Set<string>();
    for (const row of rows) {
      const tool = isRecord(row.metadata) && typeof row.metadata.tool === "string"
        ? row.metadata.tool
        : undefined;
      keys.add(buildActivityDedupKey(row.timestamp, tool, row.title));
    }

    this.dayCache.set(start, keys);
    return keys;
  }

  async has(activity: ConvexActivity): Promise<boolean> {
    const timestamp = activity.timestamp ?? Date.now();
    const dayKeys = await this.loadDay(timestamp);
    return dayKeys.has(keyFromActivity(activity));
  }

  async remember(activity: ConvexActivity): Promise<void> {
    const timestamp = activity.timestamp ?? Date.now();
    const dayKeys = await this.loadDay(timestamp);
    dayKeys.add(keyFromActivity(activity));
  }
}

async function postActivity(activity: ConvexActivity): Promise<boolean> {
  const response = await fetch(CONVEX_SITE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(activity),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  return true;
}

async function processFile(params: {
  filePath: string;
  state: BackfillState;
  options: CliOptions;
  dedupe: ConvexDedupe;
  logger: ReturnType<typeof createLogger>;
  runKeys: Set<string>;
}): Promise<ProcessFileResult> {
  const { filePath, state, options, dedupe, logger, runKeys } = params;
  const fileContent = await fs.readFile(filePath, "utf8");
  const rawLines = fileContent.split(/\r?\n/);
  const lines = rawLines[rawLines.length - 1] === "" ? rawLines.slice(0, -1) : rawLines;

  const fileState = state.files[filePath];
  const startOffset = Math.min(fileState?.lineOffset ?? 0, lines.length);
  const sessionId = path.basename(filePath, ".jsonl");
  const pendingCalls = new Map<string, PendingToolCall>();
  const stats: ProcessStats = {
    sent: 0,
    dryRun: 0,
    skippedSince: 0,
    skippedDuplicateRun: 0,
    skippedDuplicateConvex: 0,
    parseErrors: 0,
    postErrors: 0,
  };

  let halted = false;
  let nextOffset = startOffset;
  let maxTimestamp = fileState?.lastTimestamp;

  for (let index = startOffset; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      nextOffset = index + 1;
      continue;
    }

    let parsedLine: Record<string, unknown>;
    try {
      const parsed = JSON.parse(line);
      if (!isRecord(parsed)) {
        nextOffset = index + 1;
        continue;
      }
      parsedLine = parsed;
    } catch {
      stats.parseErrors += 1;
      nextOffset = index + 1;
      continue;
    }

    const timestamp = entryTimestamp(parsedLine) ?? Date.now();
    if (!maxTimestamp || timestamp > maxTimestamp) {
      maxTimestamp = timestamp;
    }

    const calls = extractToolCalls(parsedLine, timestamp);
    for (const call of calls) {
      pendingCalls.set(call.id, call.call);
    }

    const results = extractToolResults(parsedLine, timestamp);

    for (const result of results) {
      const pending = pendingCalls.get(result.toolCallId);
      if (pending) {
        pendingCalls.delete(result.toolCallId);
      }

      const toolCall: RawToolCall = {
        tool: pending?.tool ?? result.toolName ?? "unknown",
        params: pending?.params ?? {},
        result: result.result,
        timestamp: result.timestamp,
        sessionKey: sessionId,
      };

      const { activity } = enrichRawToolCall(toolCall);
      const enriched: ConvexActivity = {
        ...activity,
        metadata: {
          ...(activity.metadata ?? {}),
          tool: activityTool(activity) ?? toolCall.tool,
          sessionId,
          sessionFile: filePath,
          toolCallId: result.toolCallId,
        },
        timestamp: activity.timestamp ?? result.timestamp,
      };

      if (options.sinceMs && (enriched.timestamp ?? 0) < options.sinceMs) {
        stats.skippedSince += 1;
        continue;
      }

      const key = keyFromActivity(enriched);
      if (runKeys.has(key)) {
        stats.skippedDuplicateRun += 1;
        continue;
      }

      if (await dedupe.has(enriched)) {
        runKeys.add(key);
        stats.skippedDuplicateConvex += 1;
        continue;
      }

      if (options.dryRun) {
        runKeys.add(key);
        await dedupe.remember(enriched);
        stats.dryRun += 1;
        logger.info(`[dry-run] ${new Date(enriched.timestamp ?? Date.now()).toISOString()} ${enriched.type} ${enriched.title}`);
        continue;
      }

      try {
        await postActivity(enriched);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`[backfill] failed to post activity from ${filePath}:${index + 1} - ${message}`);
        stats.postErrors += 1;
        halted = true;
        break;
      }

      runKeys.add(key);
      await dedupe.remember(enriched);
      stats.sent += 1;
    }

    if (halted) {
      break;
    }

    nextOffset = index + 1;
  }

  return {
    halted,
    nextOffset,
    maxTimestamp,
    stats,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const logger = createLogger(options.cron);

  if (!options.cron) {
    const scope = options.dir ? `directory ${options.dir}` : "default OpenClaw locations";
    logger.info(`[backfill] scanning ${scope}`);
    if (options.sinceMs) {
      logger.info(`[backfill] since ${new Date(options.sinceMs).toISOString()}`);
    }
    if (options.dryRun) {
      logger.info("[backfill] dry-run mode enabled");
    }
  }

  const roots = options.dir ? [path.resolve(options.dir)] : defaultTranscriptDirs();
  const files = await sortedTranscriptFiles(roots);
  const state = await loadState(STATE_PATH);

  const dedupe = new ConvexDedupe(new ConvexHttpClient(CONVEX_CLOUD_URL), logger);
  const runKeys = new Set<string>();
  const totals: ProcessStats = {
    sent: 0,
    dryRun: 0,
    skippedSince: 0,
    skippedDuplicateRun: 0,
    skippedDuplicateConvex: 0,
    parseErrors: 0,
    postErrors: 0,
  };

  let filesProcessed = 0;
  let halted = false;

  for (const filePath of files) {
    if (halted) {
      break;
    }

    const result = await processFile({
      filePath,
      state,
      options,
      dedupe,
      logger,
      runKeys,
    });

    filesProcessed += 1;
    totals.sent += result.stats.sent;
    totals.dryRun += result.stats.dryRun;
    totals.skippedSince += result.stats.skippedSince;
    totals.skippedDuplicateRun += result.stats.skippedDuplicateRun;
    totals.skippedDuplicateConvex += result.stats.skippedDuplicateConvex;
    totals.parseErrors += result.stats.parseErrors;
    totals.postErrors += result.stats.postErrors;

    state.files[filePath] = {
      lineOffset: result.nextOffset,
      lastTimestamp: result.maxTimestamp,
      updatedAt: Date.now(),
    };

    if (result.halted) {
      halted = true;
    }
  }

  if (!options.dryRun) {
    await saveState(STATE_PATH, state);
  }

  if (!options.cron) {
    logger.info("[backfill] done");
    logger.info(`[backfill] files discovered: ${files.length}`);
    logger.info(`[backfill] files processed: ${filesProcessed}`);
    logger.info(`[backfill] activities sent: ${totals.sent}`);
    logger.info(`[backfill] activities dry-run: ${totals.dryRun}`);
    logger.info(`[backfill] skipped by --since: ${totals.skippedSince}`);
    logger.info(`[backfill] skipped duplicate in run: ${totals.skippedDuplicateRun}`);
    logger.info(`[backfill] skipped duplicate in Convex: ${totals.skippedDuplicateConvex}`);
    logger.info(`[backfill] parse errors: ${totals.parseErrors}`);
    logger.info(`[backfill] post errors: ${totals.postErrors}`);
    logger.info(`[backfill] state file: ${STATE_PATH}`);
  }

  if (totals.postErrors > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[backfill] fatal error: ${message}`);
  process.exitCode = 1;
});
