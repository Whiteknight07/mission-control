import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

const taskTypeValidator = v.union(
  v.literal("cron"),
  v.literal("reminder"),
  v.literal("recurring"),
);

export const listUpcoming = query({
  args: {
    enabledOnly: v.optional(v.boolean()),
    limit: v.optional(v.number()),
    fromMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 100, 200));
    const fromMs = args.fromMs ?? 0;

    const tasks = await ctx.db
      .query("scheduledTasks")
      .withIndex("by_nextFire", (q) => q.gte("nextFire", fromMs))
      .order("asc")
      .take(limit * 2);

    const filtered =
      args.enabledOnly === true
        ? tasks.filter((task) => task.enabled)
        : tasks;

    return filtered.slice(0, limit);
  },
});

export const listInWindow = query({
  args: {
    startMs: v.number(),
    endMs: v.number(),
    enabledOnly: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 200, 500));
    const lowerBound = Math.min(args.startMs, args.endMs);
    const upperBound = Math.max(args.startMs, args.endMs);

    const tasks = await ctx.db
      .query("scheduledTasks")
      .withIndex("by_nextFire", (q) => q.gte("nextFire", lowerBound).lt("nextFire", upperBound))
      .order("asc")
      .take(limit * 2);

    const filtered = args.enabledOnly === true ? tasks.filter((task) => task.enabled) : tasks;
    return filtered.slice(0, limit);
  },
});

export const getById = query({
  args: { id: v.id("scheduledTasks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const search = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 20, 100));

    return await ctx.db
      .query("scheduledTasks")
      .withSearchIndex("search_tasks", (q) => q.search("name", args.query))
      .take(limit);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    schedule: v.string(),
    type: taskTypeValidator,
    lastRun: v.optional(v.number()),
    nextFire: v.optional(v.number()),
    config: v.optional(v.any()),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("scheduledTasks", args);
  },
});

export const update = mutation({
  args: {
    id: v.id("scheduledTasks"),
    name: v.optional(v.string()),
    schedule: v.optional(v.string()),
    type: v.optional(taskTypeValidator),
    lastRun: v.optional(v.number()),
    nextFire: v.optional(v.number()),
    config: v.optional(v.any()),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...patch } = args;
    await ctx.db.patch(id, patch);
    return { ok: true };
  },
});

export const remove = mutation({
  args: { id: v.id("scheduledTasks") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { ok: true };
  },
});

function dayAtTime(dayOffset: number, hour: number, minute: number) {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, hour, minute, 0, 0);
  return date.getTime();
}

export const seedTasks = mutation({
  args: {
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("scheduledTasks").take(1);
    if (existing.length > 0 && !args.force) {
      return { created: 0, skipped: true };
    }

    if (args.force) {
      const all = await ctx.db.query("scheduledTasks").collect();
      await Promise.all(all.map((task) => ctx.db.delete(task._id)));
    }

    const demoTasks: Array<{
      name: string;
      schedule: string;
      type: "cron" | "reminder" | "recurring";
      lastRun?: number;
      nextFire: number;
      config: Record<string, unknown>;
      enabled: boolean;
    }> = [
      {
        name: "Gateway Health Probe",
        schedule: "0 */2 * * *",
        type: "cron",
        lastRun: dayAtTime(0, 8, 0),
        nextFire: dayAtTime(0, 10, 0),
        config: { endpoint: "/health", retries: 2, durationMinutes: 30 },
        enabled: true,
      },
      {
        name: "Daily Memory Snapshot",
        schedule: "15 9 * * *",
        type: "cron",
        lastRun: dayAtTime(0, 9, 15),
        nextFire: dayAtTime(1, 9, 15),
        config: { workspace: "/tmp/mc-calendar-view", durationMinutes: 40 },
        enabled: true,
      },
      {
        name: "Invoice Follow-up",
        schedule: "Tomorrow 11:30",
        type: "reminder",
        nextFire: dayAtTime(1, 11, 30),
        config: { channel: "email", priority: "high", durationMinutes: 20 },
        enabled: true,
      },
      {
        name: "Nightly Log Rotation",
        schedule: "0 2 * * *",
        type: "cron",
        lastRun: dayAtTime(-1, 2, 0),
        nextFire: dayAtTime(0, 2, 0),
        config: { target: "logs/*", compress: true, durationMinutes: 25 },
        enabled: true,
      },
      {
        name: "Dependency Vulnerability Sweep",
        schedule: "0 13 * * 1-5",
        type: "recurring",
        lastRun: dayAtTime(-1, 13, 0),
        nextFire: dayAtTime(2, 13, 0),
        config: { mode: "workspace", severity: "medium+", durationMinutes: 55 },
        enabled: true,
      },
      {
        name: "Prompt Library Backup",
        schedule: "30 17 * * 2,4",
        type: "recurring",
        lastRun: dayAtTime(-2, 17, 30),
        nextFire: dayAtTime(2, 17, 30),
        config: { provider: "s3", region: "us-west", durationMinutes: 50 },
        enabled: true,
      },
      {
        name: "Team Status Ping",
        schedule: "Weekdays 10:45",
        type: "reminder",
        lastRun: dayAtTime(-1, 10, 45),
        nextFire: dayAtTime(3, 10, 45),
        config: { recipients: 4, channel: "slack", durationMinutes: 15 },
        enabled: true,
      },
      {
        name: "Weekly Model Drift Check",
        schedule: "0 16 * * 5",
        type: "recurring",
        lastRun: dayAtTime(-6, 16, 0),
        nextFire: dayAtTime(4, 16, 0),
        config: { baseline: "prod-v4", durationMinutes: 65 },
        enabled: true,
      },
      {
        name: "Personal Focus Window",
        schedule: "Daily 07:00",
        type: "recurring",
        lastRun: dayAtTime(0, 7, 0),
        nextFire: dayAtTime(1, 7, 0),
        config: { mode: "do-not-disturb", durationMinutes: 90 },
        enabled: true,
      },
      {
        name: "Archive Completed Alerts",
        schedule: "0 21 * * *",
        type: "cron",
        lastRun: dayAtTime(-1, 21, 0),
        nextFire: dayAtTime(0, 21, 0),
        config: { keepDays: 14, durationMinutes: 35 },
        enabled: true,
      },
      {
        name: "Pay Utility Bill",
        schedule: "Friday 18:20",
        type: "reminder",
        nextFire: dayAtTime(5, 18, 20),
        config: { amount: 142.27, method: "bank", durationMinutes: 20 },
        enabled: true,
      },
      {
        name: "Experimental Canary Rollout",
        schedule: "Sat 14:00",
        type: "cron",
        nextFire: dayAtTime(6, 14, 0),
        config: { env: "canary", percent: 10, durationMinutes: 45 },
        enabled: false,
      },
    ];

    await Promise.all(demoTasks.map((task) => ctx.db.insert("scheduledTasks", task)));
    return { created: demoTasks.length, skipped: false };
  },
});

/** Upsert a task by name — used by the cron sync script */
export const upsertByName = mutation({
  args: {
    name: v.string(),
    schedule: v.string(),
    type: v.union(v.literal("cron"), v.literal("reminder"), v.literal("recurring")),
    enabled: v.boolean(),
    nextFire: v.optional(v.number()),
    lastRun: v.optional(v.number()),
    config: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("scheduledTasks")
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

    const data = {
      name: args.name,
      schedule: args.schedule,
      type: args.type,
      enabled: args.enabled,
      nextFire: args.nextFire ?? Date.now(),
      lastRun: args.lastRun,
      config: args.config ?? {},
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
      return { id: existing._id, action: "updated" as const };
    } else {
      const id = await ctx.db.insert("scheduledTasks", data);
      return { id, action: "created" as const };
    }
  },
});

/** Mark a task as just-fired — called by the webhook relay */
export const markFired = mutation({
  args: {
    name: v.string(),
    status: v.optional(v.union(v.literal("success"), v.literal("error"))),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db
      .query("scheduledTasks")
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

    if (task) {
      await ctx.db.patch(task._id, { lastRun: Date.now() });
      return { found: true };
    }
    return { found: false };
  },
});
