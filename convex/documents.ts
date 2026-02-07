import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

const documentTypeValidator = v.union(
  v.literal("memory"),
  v.literal("config"),
  v.literal("log"),
  v.literal("skill"),
);

export const list = query({
  args: {
    type: v.optional(documentTypeValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 100, 250));

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_path")
      .order("asc")
      .take(limit * 2);

    const filtered = args.type
      ? documents.filter((document) => document.type === args.type)
      : documents;

    return filtered.slice(0, limit);
  },
});

export const getByPath = query({
  args: { path: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("documents")
      .withIndex("by_path", (q) => q.eq("path", args.path))
      .unique();
  },
});

export const search = query({
  args: {
    query: v.string(),
    type: v.optional(documentTypeValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 20, 100));

    return await ctx.db
      .query("documents")
      .withSearchIndex("search_documents", (q) => {
        const base = q.search("content", args.query);
        return args.type ? base.eq("type", args.type) : base;
      })
      .take(limit);
  },
});

export const upsert = mutation({
  args: {
    path: v.string(),
    name: v.string(),
    content: v.string(),
    lastIndexed: v.optional(v.number()),
    type: documentTypeValidator,
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("documents")
      .withIndex("by_path", (q) => q.eq("path", args.path))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        content: args.content,
        lastIndexed: args.lastIndexed ?? Date.now(),
        type: args.type,
      });
      return existing._id;
    }

    return await ctx.db.insert("documents", {
      path: args.path,
      name: args.name,
      content: args.content,
      lastIndexed: args.lastIndexed ?? Date.now(),
      type: args.type,
    });
  },
});

export const removeByPath = mutation({
  args: { path: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("documents")
      .withIndex("by_path", (q) => q.eq("path", args.path))
      .unique();

    if (!existing) {
      return { ok: true, deleted: false };
    }

    await ctx.db.delete(existing._id);
    return { ok: true, deleted: true };
  },
});
