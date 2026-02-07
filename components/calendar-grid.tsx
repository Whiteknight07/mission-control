"use client";

import { useMemo } from "react";
import { CalendarClock, Loader2 } from "lucide-react";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const taskTone: Record<string, string> = {
  cron: "border-emerald-500/50 bg-emerald-950/30 text-emerald-300",
  reminder: "border-amber-500/50 bg-amber-950/30 text-amber-300",
  recurring: "border-cyan-500/50 bg-cyan-950/30 text-cyan-300",
};

export function CalendarGrid() {
  const tasks = useQuery(api.scheduledTasks.listUpcoming, { enabledOnly: true, limit: 90 });

  const week = useMemo(() => {
    const today = new Date();
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    start.setDate(today.getDate() - today.getDay());

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      return date;
    });
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, Doc<"scheduledTasks">[]>();

    for (const day of week) {
      map.set(day.toDateString(), []);
    }

    for (const task of tasks ?? []) {
      if (!task.nextFire) {
        continue;
      }

      const dayKey = new Date(task.nextFire).toDateString();
      if (!map.has(dayKey)) {
        continue;
      }

      const bucket = map.get(dayKey) ?? [];
      bucket.push(task);
      map.set(dayKey, bucket);
    }

    return map;
  }, [tasks, week]);

  if (!tasks) {
    return (
      <div className="panel-frame flex h-52 items-center justify-center rounded-2xl">
        <Loader2 className="mr-2 size-4 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Loading scheduled tasks...</span>
      </div>
    );
  }

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
      {week.map((day) => {
        const key = day.toDateString();
        const dayTasks = grouped.get(key) ?? [];

        return (
          <article key={key} className="panel-frame rounded-xl p-3">
            <div className="mb-3 border-b border-border/70 pb-3">
              <p className="font-display text-xs uppercase tracking-[0.18em] text-primary/80">
                {day.toLocaleDateString("en-US", { weekday: "short" })}
              </p>
              <p className="text-sm text-muted-foreground">{day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
            </div>

            <div className="space-y-2">
              {dayTasks.length === 0 && (
                <div className="rounded-lg border border-dashed border-border/70 p-2 text-xs text-muted-foreground">
                  No queued tasks
                </div>
              )}

              {dayTasks.map((task) => (
                <div key={task._id} className={cn("rounded-lg border p-2", taskTone[task.type] ?? "border-border bg-muted/30") }>
                  <p className="font-display text-[11px] uppercase tracking-[0.14em]">{task.name}</p>
                  <p className="mt-1 text-[11px] opacity-80">
                    {task.nextFire ? new Date(task.nextFire).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "TBD"}
                  </p>
                  <Badge variant="outline" className="mt-2 rounded-md border-current/50 bg-transparent text-[10px] uppercase">
                    {task.type}
                  </Badge>
                </div>
              ))}
            </div>
          </article>
        );
      })}

      <div className="panel-frame rounded-xl border-dashed p-3 xl:col-span-7">
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <CalendarClock className="mt-0.5 size-4 text-primary" />
          Tasks sync from Convex and update automatically as `nextFire` changes.
        </div>
      </div>
    </section>
  );
}
