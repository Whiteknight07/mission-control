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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const typeConfig: Record<
  ActivityType,
  {
    icon: ComponentType<{ className?: string }>;
    label: string;
    badgeClass: string;
    chipClass: string;
    dotClass: string;
    glowClass: string;
    borderClass: string;
  }
> = {
  email: {
    icon: Mail,
    label: "Email",
    badgeClass: "border-sky-500/45 bg-sky-500/10 text-sky-200",
    chipClass: "bg-sky-500/20 text-sky-300",
    dotClass: "bg-sky-300",
    glowClass: "shadow-[0_0_24px_-14px_rgba(56,189,248,0.95)]",
    borderClass: "border-l-sky-400/65",
  },
  code: {
    icon: Code2,
    label: "Code",
    badgeClass: "border-violet-500/45 bg-violet-500/10 text-violet-200",
    chipClass: "bg-violet-500/20 text-violet-300",
    dotClass: "bg-violet-300",
    glowClass: "shadow-[0_0_24px_-14px_rgba(139,92,246,0.95)]",
    borderClass: "border-l-violet-400/65",
  },
  cron: {
    icon: Timer,
    label: "Cron",
    badgeClass: "border-amber-500/45 bg-amber-500/10 text-amber-200",
    chipClass: "bg-amber-500/20 text-amber-300",
    dotClass: "bg-amber-300",
    glowClass: "shadow-[0_0_24px_-14px_rgba(245,158,11,0.95)]",
    borderClass: "border-l-amber-400/65",
  },
  search: {
    icon: Search,
    label: "Search",
    badgeClass: "border-cyan-500/45 bg-cyan-500/10 text-cyan-200",
    chipClass: "bg-cyan-500/20 text-cyan-300",
    dotClass: "bg-cyan-300",
    glowClass: "shadow-[0_0_24px_-14px_rgba(34,211,238,0.95)]",
    borderClass: "border-l-cyan-400/65",
  },
  message: {
    icon: AtSign,
    label: "Message",
    badgeClass: "border-fuchsia-500/45 bg-fuchsia-500/10 text-fuchsia-200",
    chipClass: "bg-fuchsia-500/20 text-fuchsia-300",
    dotClass: "bg-fuchsia-300",
    glowClass: "shadow-[0_0_24px_-14px_rgba(217,70,239,0.95)]",
    borderClass: "border-l-fuchsia-400/65",
  },
  file: {
    icon: FileText,
    label: "File",
    badgeClass: "border-indigo-500/45 bg-indigo-500/10 text-indigo-200",
    chipClass: "bg-indigo-500/20 text-indigo-300",
    dotClass: "bg-indigo-300",
    glowClass: "shadow-[0_0_24px_-14px_rgba(99,102,241,0.95)]",
    borderClass: "border-l-indigo-400/65",
  },
  browser: {
    icon: Globe,
    label: "Browser",
    badgeClass: "border-lime-500/45 bg-lime-500/10 text-lime-200",
    chipClass: "bg-lime-500/20 text-lime-300",
    dotClass: "bg-lime-300",
    glowClass: "shadow-[0_0_24px_-14px_rgba(132,204,22,0.95)]",
    borderClass: "border-l-lime-400/65",
  },
  system: {
    icon: Blocks,
    label: "System",
    badgeClass: "border-emerald-500/45 bg-emerald-500/10 text-emerald-200",
    chipClass: "bg-emerald-500/20 text-emerald-300",
    dotClass: "bg-emerald-300",
    glowClass: "shadow-[0_0_24px_-14px_rgba(16,185,129,0.95)]",
    borderClass: "border-l-emerald-400/65",
  },
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

const statusConfig: Record<StatusType, { icon: ComponentType<{ className?: string }>; className: string }> = {
  success: {
    icon: CheckCircle2,
    className: "border-emerald-500/50 bg-emerald-500/15 text-emerald-300",
  },
  error: {
    icon: AlertTriangle,
    className: "border-red-500/50 bg-red-500/15 text-red-300",
  },
  pending: {
    icon: CircleEllipsis,
    className: "border-amber-500/50 bg-amber-500/15 text-amber-300",
  },
};

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
    [activeType, visibleLimit],
  );
  const activities = useQuery(api.activities.list, queryArgs) as ActivityItem[] | undefined;

  const groupedActivities = useMemo(() => {
    if (!activities?.length) {
      return [];
    }

    const groups = new Map<string, { label: string; items: ActivityItem[] }>();

    for (const item of activities) {
      const date = new Date(item.timestamp);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const existing = groups.get(key);

      if (existing) {
        existing.items.push(item);
        continue;
      }

      groups.set(key, {
        label: formatDayLabel(date),
        items: [item],
      });
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
        <div className="panel-frame rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="font-display text-xs uppercase tracking-[0.22em] text-primary/80">Type Filter</p>
            <Badge variant="outline" className="rounded-md border-primary/35 bg-primary/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-primary/90">
              {activities.length} visible
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {activityFilters.map((filter) => {
              const isActive = activeType === filter.value;
              const Icon = filter.value === "all" ? Bot : typeConfig[filter.value].icon;
              const dotClass = filter.value === "all" ? "bg-primary/70" : typeConfig[filter.value].dotClass;

              return (
                <Button
                  key={filter.value}
                  size="xs"
                  variant={isActive ? "default" : "outline"}
                  onClick={() => {
                    setActiveType(filter.value);
                    setVisibleLimit(baseLimit);
                  }}
                  className={cn(
                    "h-7 rounded-md border font-display uppercase tracking-[0.14em]",
                    isActive
                      ? "border-primary/65 bg-primary/25 text-primary shadow-[0_0_20px_-10px_var(--color-primary)]"
                      : "border-border/80 bg-background/40 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5" />
                  <span className={cn("size-1.5 rounded-full", dotClass)} />
                  {filter.label}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {groupedActivities.length === 0 ? (
        <ActivityEmptyState />
      ) : (
        <div className={cn("space-y-4", compact && "space-y-3")}>
          {groupedActivities.map((group, groupIndex) => (
            <div key={group.label} className="space-y-3">
              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className="rounded-md border-primary/45 bg-primary/10 px-2 py-1 font-display text-[10px] uppercase tracking-[0.16em] text-primary"
                >
                  {group.label}
                </Badge>
                <div className="h-px flex-1 bg-gradient-to-r from-primary/35 via-border to-transparent" />
              </div>

              <ul className={cn("space-y-2.5", compact && "space-y-2")}>
                {group.items.map((item, itemIndex) => (
                  <ActivityCard
                    key={item._id}
                    activity={item}
                    now={timeNow}
                    compact={compact}
                    delayIndex={groupIndex * 12 + itemIndex}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {canLoadMore && (
        <div className="flex justify-center pt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setVisibleLimit((current) => current + PAGE_SIZE)}
            className="rounded-lg border-primary/45 bg-primary/10 font-display uppercase tracking-[0.14em] text-primary hover:bg-primary/20"
          >
            <ChevronDown className="size-4" />
            Load More
          </Button>
        </div>
      )}
    </section>
  );
}

function ActivityCard({
  activity,
  now,
  compact,
  delayIndex,
}: {
  activity: ActivityItem;
  now: number;
  compact: boolean;
  delayIndex: number;
}) {
  const type = typeConfig[activity.type];
  const status = statusConfig[activity.status];
  const ActivityIcon = type.icon;
  const StatusIcon = status.icon;

  return (
    <li
      className={cn(
        "activity-enter panel-frame activity-scanline relative overflow-hidden rounded-xl border p-3 sm:p-4",
        type.glowClass,
        type.borderClass,
        compact ? "border-l-2" : "border-l-[3px]",
      )}
      style={{ animationDelay: `${Math.min(delayIndex * 45, 380)}ms` }}
    >
      <div className={cn("flex items-start justify-between gap-3", compact && "gap-2")}>
        <div className="flex min-w-0 gap-3">
          <div
            className={cn(
              "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-white/10",
              type.badgeClass,
            )}
          >
            <ActivityIcon className="size-4" />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className={cn("truncate font-display text-sm uppercase tracking-[0.14em] text-foreground", compact && "text-xs")}>{activity.title}</p>
              <Badge variant="outline" className={cn("rounded-md border px-1.5 py-0 text-[10px] uppercase tracking-[0.12em]", type.badgeClass)}>
                {type.label}
              </Badge>
            </div>
            {activity.description && (
              <p className={cn("mt-1 line-clamp-2 text-sm text-muted-foreground", compact && "text-xs")}>{activity.description}</p>
            )}
          </div>
        </div>

        <Badge variant="outline" className={cn("shrink-0 rounded-md border px-1.5 py-0 text-[10px] uppercase tracking-[0.12em]", status.className)}>
          <StatusIcon className="size-3" />
          {activity.status}
        </Badge>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <p
          className="inline-flex items-center gap-1 text-xs text-muted-foreground"
          title={new Date(activity.timestamp).toLocaleString()}
        >
          <Clock3 className="size-3" />
          {formatRelativeTime(activity.timestamp, now)}
        </p>

        <span className={cn("h-1.5 w-1.5 rounded-full", type.chipClass)} />
      </div>
    </li>
  );
}

function ActivityFeedSkeleton({ compact, showFilters }: { compact: boolean; showFilters: boolean }) {
  const rows = compact ? 3 : 6;

  return (
    <section className="space-y-4">
      {showFilters && (
        <div className="panel-frame rounded-2xl p-4">
          <div className="mb-3 h-4 w-28 animate-pulse rounded bg-muted/70" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 7 }, (_, index) => (
              <div key={index} className="h-7 w-20 animate-pulse rounded-md border border-border/60 bg-muted/40" />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="panel-frame activity-scanline rounded-xl p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="h-4 w-2/5 animate-pulse rounded bg-muted/70" />
              <div className="h-4 w-16 animate-pulse rounded bg-muted/60" />
            </div>
            <div className="h-3 w-4/5 animate-pulse rounded bg-muted/55" />
            <div className="mt-3 h-3 w-24 animate-pulse rounded bg-muted/50" />
          </div>
        ))}
      </div>

      <div className="panel-frame flex items-center justify-center gap-2 rounded-xl p-3 text-xs text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-primary" />
        Syncing realtime activity stream...
      </div>
    </section>
  );
}

function ActivityEmptyState() {
  return (
    <div className="panel-frame activity-scanline relative overflow-hidden rounded-2xl p-8 text-center sm:p-10">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full border border-primary/40 bg-primary/10 shadow-[0_0_35px_-15px_var(--color-primary)]">
        <Bot className="size-8 text-primary" />
      </div>
      <p className="mt-4 font-display text-sm uppercase tracking-[0.22em] text-primary/90">No Telemetry Yet</p>
      <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
        Agent channels are quiet. Once events arrive through Convex logging, this stream will light up in realtime.
      </p>
    </div>
  );
}

function formatDayLabel(date: Date): string {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.floor((todayStart - dayStart) / 86_400_000);

  if (diffDays === 0) {
    return "Today";
  }

  if (diffDays === 1) {
    return "Yesterday";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelativeTime(timestamp: number, now: number): string {
  const diffMs = timestamp - now;
  const absMs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (absMs < 60_000) {
    return rtf.format(Math.round(diffMs / 1000), "second");
  }

  if (absMs < 3_600_000) {
    return rtf.format(Math.round(diffMs / 60_000), "minute");
  }

  if (absMs < 86_400_000) {
    return rtf.format(Math.round(diffMs / 3_600_000), "hour");
  }

  return rtf.format(Math.round(diffMs / 86_400_000), "day");
}
