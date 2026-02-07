"use client";

import { useMemo, useState } from "react";
import { CircleDashed, Clock3, Filter, Loader2 } from "lucide-react";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const activityTypes = ["all", "email", "code", "cron", "search", "message", "file", "browser", "system"] as const;

type ActivityFeedProps = {
  limit?: number;
  showFilters?: boolean;
};

export function ActivityFeed({ limit = 30, showFilters = true }: ActivityFeedProps) {
  const [activeType, setActiveType] = useState<(typeof activityTypes)[number]>("all");

  const args = activeType === "all" ? { limit } : { limit, type: activeType };
  const activities = useQuery(api.activities.list, args);

  const grouped = useMemo(() => {
    if (!activities) {
      return [];
    }

    const formatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

    const buckets = new Map<string, typeof activities>();

    for (const item of activities) {
      const key = formatter.format(new Date(item.timestamp));
      const existing = buckets.get(key) ?? [];
      existing.push(item);
      buckets.set(key, existing);
    }

    return Array.from(buckets.entries());
  }, [activities]);

  if (!activities) {
    return (
      <div className="panel-frame flex h-52 items-center justify-center rounded-2xl">
        <Loader2 className="mr-2 size-4 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Syncing activity stream...</span>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      {showFilters && (
        <div className="panel-frame rounded-xl p-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Filter className="size-3.5" />
            Activity Type Filter
          </div>
          <div className="flex flex-wrap gap-2">
            {activityTypes.map((type) => (
              <Button
                key={type}
                size="xs"
                variant={activeType === type ? "default" : "outline"}
                onClick={() => setActiveType(type)}
                className="font-display uppercase tracking-[0.14em]"
              >
                {type}
              </Button>
            ))}
          </div>
        </div>
      )}

      {grouped.length === 0 && (
        <div className="panel-frame rounded-2xl p-8 text-center">
          <CircleDashed className="mx-auto mb-2 size-5 text-primary" />
          <p className="text-sm text-muted-foreground">No activity logged yet.</p>
        </div>
      )}

      <div className="space-y-4">
        {grouped.map(([date, items]) => (
          <div key={date} className="space-y-3">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="rounded-md border-primary/50 bg-primary/10 px-2 py-1 font-display uppercase tracking-[0.14em] text-primary">
                {date}
              </Badge>
              <div className="h-px flex-1 bg-border" />
            </div>

            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item._id} className="panel-frame rounded-xl border-l-2 border-l-primary/50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-display text-sm uppercase tracking-[0.14em] text-foreground">{item.title}</p>
                    <div className="flex items-center gap-2 text-xs">
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-md uppercase",
                          item.status === "error" && "border-red-500/60 bg-red-950/40 text-red-300",
                          item.status === "pending" && "border-amber-500/60 bg-amber-950/40 text-amber-300",
                          item.status === "success" && "border-emerald-500/60 bg-emerald-950/40 text-emerald-300",
                        )}
                      >
                        {item.status}
                      </Badge>
                      <Badge variant="ghost" className="rounded-md border border-border uppercase">
                        {item.type}
                      </Badge>
                    </div>
                  </div>

                  {item.description && <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>}

                  <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock3 className="size-3" />
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
