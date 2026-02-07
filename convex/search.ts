import { v } from "convex/values";

import { action } from "./_generated/server";

type UnifiedSearchSource = "activities" | "scheduledTasks" | "documents";

type UnifiedSearchResult = {
  query: string;
  total: number;
  generatedAt: number;
  activities: Array<{
    id: string;
    source: UnifiedSearchSource;
    subtype: string;
    title: string;
    snippet: string;
    timestamp: number | null;
    relevance: number;
    status: string;
  }>;
  tasks: Array<{
    id: string;
    source: UnifiedSearchSource;
    subtype: string;
    title: string;
    snippet: string;
    timestamp: number | null;
    relevance: number;
    schedule: string;
    enabled: boolean;
  }>;
  documents: Array<{
    id: string;
    source: UnifiedSearchSource;
    subtype: string;
    title: string;
    snippet: string;
    timestamp: number | null;
    relevance: number;
    path: string;
  }>;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function scoreFromRank(rank: number, size: number) {
  if (size <= 1) {
    return 1;
  }

  return clamp(1 - rank / (size - 1), 0.2, 1);
}

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function buildSnippet(value: string, query: string, length = 180) {
  const text = compactWhitespace(value);
  if (!text) {
    return "";
  }

  if (!query) {
    return text.length > length ? `${text.slice(0, length)}...` : text;
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const matchIndex = lowerText.indexOf(lowerQuery);

  if (matchIndex === -1) {
    return text.length > length ? `${text.slice(0, length)}...` : text;
  }

  const prefixLength = Math.floor((length - lowerQuery.length) / 2);
  const start = Math.max(0, matchIndex - prefixLength);
  const end = Math.min(text.length, start + length);
  const snippet = text.slice(start, end);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < text.length ? "..." : "";

  return `${prefix}${snippet}${suffix}`;
}

export const unifiedSearch = action({
  args: {
    query: v.string(),
    limitPerType: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<UnifiedSearchResult> => {
    // Dynamic import to break circular type reference with generated api.
    const { api } = await import("./_generated/api");
    const query = args.query.trim();
    const limitPerType = clamp(args.limitPerType ?? 10, 1, 24);

    if (query.length < 2) {
      return {
        query,
        total: 0,
        generatedAt: Date.now(),
        activities: [],
        tasks: [],
        documents: [],
      };
    }

    const [activities, scheduledTasks, documents] = await Promise.all([
      ctx.runQuery(api.activities.search, { query, limit: limitPerType }),
      ctx.runQuery(api.scheduledTasks.search, { query, limit: limitPerType }),
      ctx.runQuery(api.documents.search, { query, limit: limitPerType }),
    ]);

    const mappedActivities = activities.map((item, index) => ({
      id: item._id,
      source: "activities" as const,
      subtype: item.type,
      title: item.title,
      snippet: buildSnippet(`${item.title} ${item.description ?? ""}`, query),
      timestamp: item.timestamp,
      relevance: scoreFromRank(index, activities.length),
      status: item.status,
    }));

    const mappedTasks = scheduledTasks.map((task, index) => ({
      id: task._id,
      source: "scheduledTasks" as const,
      subtype: task.type,
      title: task.name,
      snippet: buildSnippet(`${task.schedule} ${task.enabled ? "enabled" : "disabled"}`, query),
      timestamp: task.nextFire ?? task.lastRun ?? null,
      relevance: scoreFromRank(index, scheduledTasks.length),
      schedule: task.schedule,
      enabled: task.enabled,
    }));

    const mappedDocuments = documents.map((document, index) => ({
      id: document._id,
      source: "documents" as const,
      subtype: document.type,
      title: document.name,
      snippet: buildSnippet(document.content, query),
      timestamp: document.lastIndexed,
      relevance: scoreFromRank(index, documents.length),
      path: document.path,
    }));

    return {
      query,
      total: mappedActivities.length + mappedTasks.length + mappedDocuments.length,
      generatedAt: Date.now(),
      activities: mappedActivities,
      tasks: mappedTasks,
      documents: mappedDocuments,
    };
  },
});
