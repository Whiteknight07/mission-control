import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

const activityTypeValidator = v.union(
  v.literal("email"),
  v.literal("code"),
  v.literal("cron"),
  v.literal("search"),
  v.literal("message"),
  v.literal("file"),
  v.literal("browser"),
  v.literal("system"),
);

const activityStatusValidator = v.union(
  v.literal("success"),
  v.literal("error"),
  v.literal("pending"),
);

export const list = query({
  args: {
    type: v.optional(activityTypeValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 50, 200));

    if (args.type) {
      return await ctx.db
        .query("activities")
        .withIndex("by_type", (q) => q.eq("type", args.type!))
        .order("desc")
        .take(limit);
    }

    return await ctx.db
      .query("activities")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit);
  },
});

export const getById = query({
  args: { id: v.id("activities") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const search = query({
  args: {
    query: v.string(),
    type: v.optional(activityTypeValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 20, 100));

    return await ctx.db
      .query("activities")
      .withSearchIndex("search_activities", (q) => {
        const base = q.search("title", args.query);
        return args.type ? base.eq("type", args.type) : base;
      })
      .take(limit);
  },
});

export const listByTimestampRange = query({
  args: {
    start: v.number(),
    end: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 5000, 10000));

    return await ctx.db
      .query("activities")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", args.start).lte("timestamp", args.end))
      .order("asc")
      .take(limit);
  },
});

export const create = mutation({
  args: {
    timestamp: v.optional(v.number()),
    type: activityTypeValidator,
    title: v.string(),
    description: v.optional(v.string()),
    metadata: v.optional(v.any()),
    status: activityStatusValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("activities", {
      timestamp: args.timestamp ?? Date.now(),
      type: args.type,
      title: args.title,
      description: args.description,
      metadata: args.metadata,
      status: args.status,
    });
  },
});

export const logFromHttp = mutation({
  args: {
    type: activityTypeValidator,
    title: v.string(),
    description: v.optional(v.string()),
    metadata: v.optional(v.any()),
    status: v.optional(activityStatusValidator),
    timestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("activities", {
      timestamp: args.timestamp ?? Date.now(),
      type: args.type,
      title: args.title,
      description: args.description,
      metadata: args.metadata,
      status: args.status ?? "success",
    });
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("activities"),
    status: activityStatusValidator,
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status });
    return { ok: true };
  },
});

export const remove = mutation({
  args: { id: v.id("activities") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { ok: true };
  },
});
