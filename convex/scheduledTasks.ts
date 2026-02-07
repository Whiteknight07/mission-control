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
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 100, 200));

    const tasks = await ctx.db
      .query("scheduledTasks")
      .withIndex("by_nextFire")
      .order("asc")
      .take(limit * 2);

    const filtered =
      args.enabledOnly === true
        ? tasks.filter((task) => task.enabled)
        : tasks;

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
