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
  email: { icon: Mail, label: "EMAIL", color: "#00ffff" },
  code: { icon: Code2, label: "CODE", color: "#ff00ff" },
  cron: { icon: Timer, label: "CRON", color: "#ffff00" },
  search: { icon: Search, label: "SEARCH", color: "#00ff00" },
  message: { icon: AtSign, label: "MSG", color: "#ff6600" },
  file: { icon: FileText, label: "FILE", color: "#ff0066" },
  browser: { icon: Globe, label: "WEB", color: "#6600ff" },
  system: { icon: Blocks, label: "SYS", color: "#00ff99" },
};

const statusConfig: Record<StatusType, { icon: ComponentType<{ className?: string }>; color: string }> = {
  success: { icon: CheckCircle2, color: "#00ff00" },
  error: { icon: AlertTriangle, color: "#ff0000" },
  pending: { icon: CircleEllipsis, color: "#ffff00" },
};

const activityFilters: Array<{ value: "all" | ActivityType; label: string }> = [
  { value: "all", label: "ALL" },
  { value: "email", label: "EMAIL" },
  { value: "code", label: "CODE" },
  { value: "cron", label: "CRON" },
  { value: "search", label: "SEARCH" },
  { value: "message", label: "MSG" },
  { value: "file", label: "FILE" },
  { value: "browser", label: "WEB" },
  { value: "system", label: "SYS" },
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
        <div className="border-4 border-[#ff00ff] bg-black p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-widest text-[#ff00ff]">FILTER_TYPE</p>
            <span className="bg-[#ff00ff] px-2 py-0.5 text-[10px] font-black text-black">
              {activities.length} ITEMS
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
                    "px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all",
                    isActive
                      ? "bg-[#ff00ff] text-black"
                      : "border-2 border-[#ff00ff]/50 text-[#ff00ff] hover:border-[#ff00ff] hover:bg-[#ff00ff]/10"
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
        <div className="border-4 border-dashed border-[#ff00ff]/50 bg-black p-8 text-center">
          <Bot className="mx-auto size-12 text-[#ff00ff]" />
          <p className="mt-4 text-sm font-black uppercase tracking-widest text-[#ff00ff]">NO_DATA</p>
          <p className="mt-2 text-xs text-[#ff00ff]/70">Waiting for agent telemetry...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedActivities.map((group) => (
            <div key={group.label} className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="bg-[#00ffff] px-2 py-0.5 text-[10px] font-black text-black">{group.label}</span>
                <div className="h-[2px] flex-1 bg-gradient-to-r from-[#00ffff] to-transparent" />
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
          className="flex w-full items-center justify-center gap-2 border-4 border-[#00ffff] bg-black py-3 text-xs font-black uppercase tracking-widest text-[#00ffff] transition-colors hover:bg-[#00ffff] hover:text-black"
        >
          <ChevronDown className="size-4" />
          LOAD_MORE
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
    <li
      className="group border-l-4 bg-black p-3 transition-all hover:translate-x-1"
      style={{ borderLeftColor: type.color }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div
            className="flex size-10 shrink-0 items-center justify-center"
            style={{ backgroundColor: type.color }}
          >
            <Icon className="size-5 text-black" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className={cn("truncate text-sm font-black uppercase tracking-wider text-white", compact && "text-xs")}>
                {activity.title}
              </p>
              <span
                className="px-1.5 py-0.5 text-[9px] font-black text-black"
                style={{ backgroundColor: type.color }}
              >
                {type.label}
              </span>
            </div>
            {activity.description && (
              <p className={cn("mt-1 line-clamp-2 text-xs text-white/60", compact && "text-[11px]")}>
                {activity.description}
              </p>
            )}
          </div>
        </div>

        <div
          className="flex shrink-0 items-center gap-1 px-1.5 py-0.5 text-[9px] font-black text-black"
          style={{ backgroundColor: status.color }}
        >
          <StatusIcon className="size-3" />
          {activity.status.toUpperCase()}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] text-white/50">
        <span className="flex items-center gap-1">
          <Clock3 className="size-3" />
          {formatRelativeTime(activity.timestamp, now)}
        </span>
        <div className="h-2 w-2" style={{ backgroundColor: type.color }} />
      </div>
    </li>
  );
}

function ActivityFeedSkeleton({ compact, showFilters }: { compact: boolean; showFilters: boolean }) {
  const rows = compact ? 3 : 6;
  return (
    <section className="space-y-4">
      {showFilters && (
        <div className="border-4 border-[#ff00ff]/50 bg-black p-4">
          <div className="mb-3 h-4 w-28 animate-pulse bg-[#ff00ff]/30" />
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-8 w-16 animate-pulse border-2 border-[#ff00ff]/30" />
            ))}
          </div>
        </div>
      )}
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="border-l-4 border-[#ff00ff]/30 bg-black p-4">
            <div className="mb-2 h-4 w-3/5 animate-pulse bg-white/10" />
            <div className="h-3 w-2/5 animate-pulse bg-white/5" />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-2 border-4 border-[#ff00ff]/30 bg-black p-4">
        <Loader2 className="size-4 animate-spin text-[#ff00ff]" />
        <span className="text-xs font-black uppercase tracking-widest text-[#ff00ff]">SYNCING...</span>
      </div>
    </section>
  );
}

function formatDayLabel(date: Date): string {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.floor((todayStart - dayStart) / 86_400_000);
  if (diffDays === 0) return "TODAY";
  if (diffDays === 1) return "YESTERDAY";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase();
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
