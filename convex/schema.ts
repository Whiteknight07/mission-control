import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  activities: defineTable({
    timestamp: v.number(),
    type: v.string(), // email, code, cron, search, message, file, browser, system
    title: v.string(),
    description: v.optional(v.string()),
    metadata: v.optional(v.any()),
    status: v.string(), // success, error, pending
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_type", ["type", "timestamp"])
    .searchIndex("search_activities", {
      searchField: "title",
      filterFields: ["type"],
    }),

  scheduledTasks: defineTable({
    name: v.string(),
    schedule: v.string(), // cron expression or description
    type: v.string(), // cron, reminder, recurring
    lastRun: v.optional(v.number()),
    nextFire: v.optional(v.number()),
    config: v.optional(v.any()),
    enabled: v.boolean(),
  })
    .index("by_nextFire", ["nextFire"])
    .searchIndex("search_tasks", {
      searchField: "name",
    }),

  documents: defineTable({
    path: v.string(),
    name: v.string(),
    content: v.string(),
    lastIndexed: v.number(),
    type: v.string(), // memory, config, log, skill
  })
    .index("by_path", ["path"])
    .searchIndex("search_documents", {
      searchField: "content",
      filterFields: ["type"],
    }),
});
