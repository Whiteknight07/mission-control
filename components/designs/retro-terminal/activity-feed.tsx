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
  email: { icon: Mail, label: "MAIL" },
  code: { icon: Code2, label: "CODE" },
  cron: { icon: Timer, label: "CRON" },
  search: { icon: Search, label: "GREP" },
  message: { icon: AtSign, label: "MSG" },
  file: { icon: FileText, label: "FILE" },
  browser: { icon: Globe, label: "HTTP" },
  system: { icon: Blocks, label: "SYS" },
};

const statusConfig: Record<StatusType, { icon: ComponentType<{ className?: string }>; label: string; color: string }> = {
  success: { icon: CheckCircle2, label: "OK", color: "text-[#33ff33]" },
  error: { icon: AlertTriangle, label: "ERR", color: "text-[#ff3333]" },
  pending: { icon: CircleEllipsis, label: "...", color: "text-[#ffff33]" },
};

const activityFilters: Array<{ value: "all" | ActivityType; label: string }> = [
  { value: "all", label: "*" },
  { value: "email", label: "mail" },
  { value: "code", label: "code" },
  { value: "cron", label: "cron" },
  { value: "search", label: "grep" },
  { value: "message", label: "msg" },
  { value: "file", label: "file" },
  { value: "browser", label: "http" },
  { value: "system", label: "sys" },
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
    <section className="space-y-3 font-mono text-[#33ff33]">
      {showFilters && (
        <div className="rounded border border-[#33ff33]/30 bg-black p-3">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-[#33ff33]/50">$ filter --type=</span>
            <span className="text-[#33ff33]/50">[{activities.length} entries]</span>
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
                    "rounded px-2 py-1 text-xs transition-all",
                    isActive
                      ? "bg-[#33ff33] text-black"
                      : "border border-[#33ff33]/30 text-[#33ff33]/70 hover:border-[#33ff33] hover:text-[#33ff33]"
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
        <div className="rounded border border-dashed border-[#33ff33]/30 bg-black p-8 text-center">
          <Bot className="mx-auto size-10 text-[#33ff33]/50" />
          <p className="mt-3 text-sm text-[#33ff33]/70">$ cat /dev/null</p>
          <p className="mt-1 text-xs text-[#33ff33]/50">No activity data. Awaiting input...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupedActivities.map((group) => (
            <div key={group.label} className="space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#33ff33]/50"># {group.label}</span>
                <div className="h-px flex-1 bg-[#33ff33]/20" />
              </div>

              <ul className="space-y-1">
                {group.items.map((item, idx) => (
                  <ActivityCard key={item._id} activity={item} now={timeNow} compact={compact} index={idx} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {canLoadMore && (
        <button
          onClick={() => setVisibleLimit((c) => c + PAGE_SIZE)}
          className="flex w-full items-center justify-center gap-2 rounded border border-[#33ff33]/30 bg-black py-2 text-xs text-[#33ff33]/70 transition-all hover:border-[#33ff33] hover:text-[#33ff33]"
        >
          <ChevronDown className="size-3" />
          $ tail -n +{visibleLimit} | more
        </button>
      )}

      {/* Scanline overlay */}
      <div className="pointer-events-none fixed inset-0 z-[100] bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.05)_50%)] bg-[length:100%_4px]" />
    </section>
  );
}

function ActivityCard({ activity, now, compact, index }: { activity: ActivityItem; now: number; compact: boolean; index: number }) {
  const type = typeConfig[activity.type];
  const status = statusConfig[activity.status];
  const time = new Date(activity.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <li className="group rounded border border-[#33ff33]/20 bg-black/50 p-2 transition-all hover:border-[#33ff33]/50 hover:bg-[#33ff33]/5">
      <div className="flex items-start gap-2 text-xs">
        <span className="shrink-0 text-[#33ff33]/40">[{time}]</span>
        <span className={cn("shrink-0 font-bold", status.color)}>[{status.label}]</span>
        <span className="shrink-0 text-[#33ff33]/60">[{type.label}]</span>
        <span className={cn("flex-1 truncate", compact ? "text-[11px]" : "")}>
          {activity.title}
        </span>
      </div>
      {activity.description && !compact && (
        <p className="mt-1 pl-[72px] text-[11px] text-[#33ff33]/50 line-clamp-1">
          # {activity.description}
        </p>
      )}
    </li>
  );
}

function ActivityFeedSkeleton({ compact, showFilters }: { compact: boolean; showFilters: boolean }) {
  const rows = compact ? 3 : 6;
  return (
    <section className="space-y-3 font-mono">
      {showFilters && (
        <div className="rounded border border-[#33ff33]/20 bg-black p-3">
          <div className="mb-2 h-3 w-32 animate-pulse bg-[#33ff33]/20" />
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-6 w-12 animate-pulse rounded border border-[#33ff33]/20 bg-[#33ff33]/10" />
            ))}
          </div>
        </div>
      )}
      <div className="space-y-1">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="rounded border border-[#33ff33]/20 bg-black p-2">
            <div className="h-3 w-full animate-pulse bg-[#33ff33]/20" />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-2 rounded border border-[#33ff33]/20 p-3 text-xs text-[#33ff33]/50">
        <Loader2 className="size-3 animate-spin" />
        Loading...
      </div>
    </section>
  );
}

function formatDayLabel(date: Date): string {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.floor((todayStart - dayStart) / 86_400_000);
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  return date.toISOString().split("T")[0];
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
