"use client";

import { type ComponentType, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  AtSign,
  Blocks,
  Bot,
  CheckCircle2,
  ChevronDown,
  CircleEllipsis,
  Clock3,
  Code2,
  FileText,
  Globe,
  Loader2,
  Mail,
  Search,
  Timer,
} from "lucide-react";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

type ActivityType = "email" | "code" | "cron" | "search" | "message" | "file" | "browser" | "system";
type StatusType = "success" | "error" | "pending";

type ActivityItem = {
  _id: string;
  timestamp: number;
  type: ActivityType;
  title: string;
  description?: string;
  status: StatusType;
};

const PAGE_SIZE = 20;
const COMPACT_PAGE_SIZE = 5;

const typeConfig: Record<ActivityType, { icon: ComponentType<{ className?: string }>; label: string; color: string }> = {
  email: { icon: Mail, label: "Email", color: "from-sky-400 to-blue-500" },
  code: { icon: Code2, label: "Code", color: "from-violet-400 to-purple-500" },
  cron: { icon: Timer, label: "Cron", color: "from-amber-400 to-orange-500" },
  search: { icon: Search, label: "Search", color: "from-cyan-400 to-teal-500" },
  message: { icon: AtSign, label: "Message", color: "from-pink-400 to-rose-500" },
  file: { icon: FileText, label: "File", color: "from-indigo-400 to-blue-500" },
  browser: { icon: Globe, label: "Browser", color: "from-lime-400 to-green-500" },
  system: { icon: Blocks, label: "System", color: "from-emerald-400 to-teal-500" },
};

const statusConfig: Record<StatusType, { icon: ComponentType<{ className?: string }>; color: string }> = {
  success: { icon: CheckCircle2, color: "text-emerald-400" },
  error: { icon: AlertTriangle, color: "text-red-400" },
  pending: { icon: CircleEllipsis, color: "text-amber-400" },
};

const activityFilters: Array<{ value: "all" | ActivityType; label: string }> = [
  { value: "all", label: "All" },
  { value: "email", label: "Email" },
  { value: "code", label: "Code" },
  { value: "cron", label: "Cron" },
  { value: "search", label: "Search" },
  { value: "message", label: "Message" },
  { value: "file", label: "File" },
  { value: "browser", label: "Browser" },
  { value: "system", label: "System" },
];

type ActivityFeedProps = {
  limit?: number;
  showFilters?: boolean;
  compact?: boolean;
};

export function ActivityFeed({ limit, showFilters = true, compact = false }: ActivityFeedProps) {
  const baseLimit = limit ?? (compact ? COMPACT_PAGE_SIZE : PAGE_SIZE);
  const [activeType, setActiveType] = useState<"all" | ActivityType>("all");
  const [visibleLimit, setVisibleLimit] = useState(baseLimit);
  const [timeNow, setTimeNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setTimeNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const queryArgs = useMemo(
    () => (activeType === "all" ? { limit: visibleLimit } : { limit: visibleLimit, type: activeType }),
    [activeType, visibleLimit]
  );
  const activities = useQuery(api.activities.list, queryArgs) as ActivityItem[] | undefined;

  const groupedActivities = useMemo(() => {
    if (!activities?.length) return [];
    const groups = new Map<string, { label: string; items: ActivityItem[] }>();
    for (const item of activities) {
      const date = new Date(item.timestamp);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const existing = groups.get(key);
      if (existing) {
        existing.items.push(item);
      } else {
        groups.set(key, { label: formatDayLabel(date), items: [item] });
      }
    }
    return Array.from(groups.values());
  }, [activities]);

  const canLoadMore = !compact && !!activities && activities.length >= visibleLimit;

  if (!activities) {
    return <ActivityFeedSkeleton compact={compact} showFilters={showFilters} />;
  }

  return (
    <section className="space-y-4">
      {showFilters && (
        <div className="rounded-3xl border border-white/20 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-medium text-white/80">Filter by type</p>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/70">
              {activities.length} events
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {activityFilters.map((filter) => {
              const isActive = activeType === filter.value;
              return (
                <button
                  key={filter.value}
                  onClick={() => {
                    setActiveType(filter.value);
                    setVisibleLimit(baseLimit);
                  }}
                  className={cn(
                    "rounded-xl px-4 py-2 text-xs font-medium transition-all duration-200",
                    isActive
                      ? "bg-white/25 text-white shadow-lg shadow-white/10"
                      : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {groupedActivities.length === 0 ? (
        <div className="rounded-3xl border border-white/20 bg-white/10 p-12 text-center shadow-xl backdrop-blur-xl">
          <div className="mx-auto flex size-20 items-center justify-center rounded-3xl bg-white/10 shadow-inner shadow-white/10">
            <Bot className="size-10 text-white/60" />
          </div>
          <p className="mt-4 text-lg font-medium text-white">No activity yet</p>
          <p className="mt-2 text-sm text-white/50">Events will appear here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedActivities.map((group) => (
            <div key={group.label} className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm">
                  {group.label}
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent" />
              </div>

              <ul className="space-y-2">
                {group.items.map((item) => (
                  <ActivityCard key={item._id} activity={item} now={timeNow} compact={compact} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {canLoadMore && (
        <button
          onClick={() => setVisibleLimit((c) => c + PAGE_SIZE)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 py-4 text-sm font-medium text-white/80 backdrop-blur-xl transition-all hover:bg-white/20"
        >
          <ChevronDown className="size-4" />
          Load more
        </button>
      )}
    </section>
  );
}

function ActivityCard({ activity, now, compact }: { activity: ActivityItem; now: number; compact: boolean }) {
  const type = typeConfig[activity.type];
  const status = statusConfig[activity.status];
  const Icon = type.icon;
  const StatusIcon = status.icon;

  return (
    <li className="group overflow-hidden rounded-2xl border border-white/20 bg-white/10 p-4 shadow-lg shadow-black/10 backdrop-blur-xl transition-all duration-200 hover:bg-white/15 hover:shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg", type.color)}>
            <Icon className="size-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className={cn("truncate font-medium text-white", compact ? "text-sm" : "text-base")}>
                {activity.title}
              </p>
              <span className={cn("rounded-lg bg-gradient-to-r px-2 py-0.5 text-[10px] font-medium text-white", type.color)}>
                {type.label}
              </span>
            </div>
            {activity.description && (
              <p className={cn("mt-1 line-clamp-2 text-white/50", compact ? "text-xs" : "text-sm")}>
                {activity.description}
              </p>
            )}
          </div>
        </div>

        <div className={cn("flex shrink-0 items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-xs font-medium", status.color)}>
          <StatusIcon className="size-3.5" />
          {activity.status}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-white/40">
        <span className="flex items-center gap-1.5">
          <Clock3 className="size-3.5" />
          {formatRelativeTime(activity.timestamp, now)}
        </span>
        <div className={cn("size-2 rounded-full bg-gradient-to-r", type.color)} />
      </div>
    </li>
  );
}

function ActivityFeedSkeleton({ compact, showFilters }: { compact: boolean; showFilters: boolean }) {
  const rows = compact ? 3 : 6;
  return (
    <section className="space-y-4">
      {showFilters && (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
          <div className="mb-4 h-4 w-24 animate-pulse rounded-full bg-white/10" />
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-9 w-16 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        </div>
      )}
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
            <div className="mb-2 h-4 w-3/5 animate-pulse rounded-full bg-white/10" />
            <div className="h-3 w-2/5 animate-pulse rounded-full bg-white/5" />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
        <Loader2 className="size-4 animate-spin text-white/40" />
        <span className="text-sm text-white/40">Syncing...</span>
      </div>
    </section>
  );
}

function formatDayLabel(date: Date): string {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.floor((todayStart - dayStart) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatRelativeTime(timestamp: number, now: number): string {
  const diffMs = timestamp - now;
  const absMs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (absMs < 60_000) return rtf.format(Math.round(diffMs / 1000), "second");
  if (absMs < 3_600_000) return rtf.format(Math.round(diffMs / 60_000), "minute");
  if (absMs < 86_400_000) return rtf.format(Math.round(diffMs / 3_600_000), "hour");
  return rtf.format(Math.round(diffMs / 86_400_000), "day");
}
