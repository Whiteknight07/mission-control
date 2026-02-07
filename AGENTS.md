# Mission Control — Clawd's Dashboard

A real-time dashboard for monitoring an AI agent's activities, scheduled tasks, and workspace.

## Tech Stack
- **Framework**: Next.js 14+ (App Router)
- **Database**: Convex (real-time subscriptions, full-text search)
- **Styling**: Tailwind CSS + shadcn/ui
- **Hosting**: Self-hosted (local + Tailscale)
- **No auth required** — Tailscale-only access

## Architecture

Three main features, all powered by Convex real-time subscriptions:

### 1. Activity Feed (`/activity`)
- Chronological feed of every agent action
- Convex `activities` table: `timestamp`, `type`, `title`, `description`, `metadata`, `status`
- Types: `email`, `code`, `cron`, `search`, `message`, `file`, `browser`, `system`
- Infinite scroll with type filters and date grouping
- Real-time updates via Convex subscriptions
- HTTP mutation endpoint for external logging (the agent posts here)

### 2. Calendar View (`/calendar`)
- Weekly grid showing all scheduled/recurring tasks
- Convex `scheduledTasks` table: `name`, `schedule`, `type`, `lastRun`, `nextFire`, `config`
- Tasks rendered as colored blocks by type
- Click task → detail panel (config, history, next fire)
- Synced from gateway cron API

### 3. Global Search (`/search`)
- Single search bar, results grouped by type
- Convex full-text search indexes on `activities`, `documents`, `scheduledTasks`
- `documents` table: indexed workspace files (memory, config, logs)
- Snippets with query highlighting

## Design Direction
- Dark mode default
- Dragon/sysadmin aesthetic — think terminal meets modern dashboard
- See `/root/.agents/skills/frontend-design/SKILL.md` for design guidelines (MANDATORY)

## Required Skills (READ THESE)
The following skill files exist on disk. Read them for best practices:

- **Frontend Design**: `/root/.agents/skills/frontend-design/SKILL.md` — MANDATORY for all UI work
- **Convex**: `/root/.agents/skills/convex/SKILL.md` — Convex development patterns
- **Convex Docs**: https://docs.convex.dev/llms.txt — LLM-optimized Convex documentation
- **Vercel React Best Practices**: `/root/.agents/skills/vercel-react-best-practices/SKILL.md` — 57 performance rules
- **Next.js Best Practices**: `/tmp/skills-vpNGIf/skills/next-best-practices/SKILL.md` — File conventions, RSC, async patterns

## Convex Schema

```typescript
// convex/schema.ts
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
```

## Project Structure

```
mission-control/
├── app/
│   ├── layout.tsx          # Root layout with nav
│   ├── page.tsx            # Dashboard overview
│   ├── activity/
│   │   └── page.tsx        # Activity feed
│   ├── calendar/
│   │   └── page.tsx        # Calendar view
│   └── search/
│       └── page.tsx        # Global search
├── components/
│   ├── ui/                 # shadcn components
│   ├── nav.tsx             # Navigation
│   ├── activity-feed.tsx   # Activity feed component
│   ├── calendar-grid.tsx   # Weekly calendar grid
│   └── search-bar.tsx      # Search component
├── convex/
│   ├── schema.ts           # Database schema
│   ├── activities.ts       # Activity queries/mutations
│   ├── scheduledTasks.ts   # Task queries/mutations
│   ├── documents.ts        # Document queries/mutations
│   └── http.ts             # HTTP endpoints for external logging
├── lib/
│   └── utils.ts            # Utility functions
└── public/
```

## Git Practices
- Atomic commits: `feat:`, `fix:`, `refactor:`, `docs:`, `style:`
- Branch per feature when working in parallel
- Meaningful commit messages

## Key Constraints
- No authentication needed
- Dark mode by default
- Real-time updates everywhere (Convex subscriptions)
- HTTP endpoint for activity logging (POST from external agent)
- Self-hosted on port 3000, served via Tailscale
