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

const typeConfig: Record<ActivityType, { icon: ComponentType<{ className?: string }>; label: string }> = {
  email: { icon: Mail, label: "Email" },
  code: { icon: Code2, label: "Code" },
  cron: { icon: Timer, label: "Cron" },
  search: { icon: Search, label: "Search" },
  message: { icon: AtSign, label: "Message" },
  file: { icon: FileText, label: "File" },
  browser: { icon: Globe, label: "Browser" },
  system: { icon: Blocks, label: "System" },
};

const statusConfig: Record<StatusType, { icon: ComponentType<{ className?: string }> }> = {
  success: { icon: CheckCircle2 },
  error: { icon: AlertTriangle },
  pending: { icon: CircleEllipsis },
};

const activityFilters: Array<{ value: "all" | ActivityType; label: string }> = [
  { value: "all", label: "All" },
  { value: "email", label: "Email" },
  { value: "code", label: "Code" },
  { value: "cron", label: "Cron" },
  { value: "search", label: "Search" },
  { value: "message", label: "Msg" },
  { value: "file", label: "File" },
  { value: "browser", label: "Web" },
  { value: "system", label: "Sys" },
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
    <section className="space-y-6">
      {showFilters && (
        <div className="border-b border-neutral-800 pb-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs text-neutral-500">Filter</span>
            <span className="text-xs text-neutral-600">{activities.length} items</span>
          </div>
          <div className="flex flex-wrap gap-1">
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
                    "px-3 py-1.5 text-xs transition-colors",
                    isActive
                      ? "bg-white text-black"
                      : "text-neutral-500 hover:bg-neutral-900 hover:text-white"
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
        <div className="py-16 text-center">
          <Bot className="mx-auto size-8 text-neutral-700" />
          <p className="mt-4 text-sm text-neutral-500">No activity</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedActivities.map((group) => (
            <div key={group.label} className="space-y-2">
              <h3 className="text-xs text-neutral-500">{group.label}</h3>
              <ul className="divide-y divide-neutral-800/50">
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
          className="flex w-full items-center justify-center gap-2 border border-neutral-800 py-3 text-xs text-neutral-400 transition-colors hover:bg-neutral-900 hover:text-white"
        >
          <ChevronDown className="size-3" />
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
    <li className="group py-3 transition-colors hover:bg-neutral-900/50">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <Icon className="mt-0.5 size-4 shrink-0 text-neutral-600" />
          <div className="min-w-0">
            <p className={cn("text-white", compact ? "text-sm" : "text-base")}>{activity.title}</p>
            {activity.description && !compact && (
              <p className="mt-1 text-sm text-neutral-500 line-clamp-1">{activity.description}</p>
            )}
            <div className="mt-1 flex items-center gap-3 text-xs text-neutral-600">
              <span>{type.label}</span>
              <span>·</span>
              <span>{formatRelativeTime(activity.timestamp, now)}</span>
            </div>
          </div>
        </div>
        <div className={cn(
          "flex shrink-0 items-center gap-1 text-xs",
          activity.status === "success" && "text-neutral-400",
          activity.status === "error" && "text-white",
          activity.status === "pending" && "text-neutral-500"
        )}>
          <StatusIcon className="size-3" />
          {activity.status}
        </div>
      </div>
    </li>
  );
}

function ActivityFeedSkeleton({ compact, showFilters }: { compact: boolean; showFilters: boolean }) {
  const rows = compact ? 3 : 6;
  return (
    <section className="space-y-6">
      {showFilters && (
        <div className="border-b border-neutral-800 pb-4">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-8 w-14 animate-pulse bg-neutral-900" />
            ))}
          </div>
        </div>
      )}
      <div className="divide-y divide-neutral-800/50">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="py-3">
            <div className="mb-2 h-4 w-3/5 animate-pulse bg-neutral-900" />
            <div className="h-3 w-1/4 animate-pulse bg-neutral-900" />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-2 py-4 text-xs text-neutral-600">
        <Loader2 className="size-3 animate-spin" />
        Loading
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
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
