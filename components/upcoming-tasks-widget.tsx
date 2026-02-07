"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "convex/react";
import { CalendarClock, Clock3, Loader2 } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const badgeTone: Record<string, string> = {
  cron: "border-emerald-400/50 bg-emerald-950/60 text-emerald-300",
  reminder: "border-amber-400/50 bg-amber-950/60 text-amber-300",
  recurring: "border-sky-400/50 bg-sky-950/60 text-sky-300",
};

export function UpcomingTasksWidget() {
  const [fromMs] = useState(() => Date.now());

  const tasks = useQuery(api.scheduledTasks.listUpcoming, {
    enabledOnly: true,
    limit: 5,
    fromMs,
  });

  if (!tasks) {
    return (
      <section className="panel-frame rounded-2xl p-5">
        <div className="mb-4 h-5 w-40 animate-pulse rounded bg-primary/20" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-lg bg-muted/45" />
          ))}
        </div>
        <div className="mt-4 flex items-center text-xs text-muted-foreground">
          <Loader2 className="mr-2 size-3.5 animate-spin text-primary" />
          Loading upcoming tasks...
        </div>
      </section>
    );
  }

  return (
    <section className="panel-frame rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-display text-xs uppercase tracking-[0.2em] text-primary/80">Scheduler</p>
          <h2 className="mt-1 font-display text-xl uppercase tracking-[0.14em]">Upcoming Tasks</h2>
        </div>
        <CalendarClock className="size-5 text-primary" />
      </div>

      <div className="mt-4 space-y-2">
        {tasks.length === 0 && (
          <div className="rounded-lg border border-dashed border-border/80 p-4 text-sm text-muted-foreground">
            No future tasks found. Seed demo tasks from the calendar view.
          </div>
        )}

        {tasks.map((task) => (
          <article key={task._id} className="rounded-lg border border-border/70 bg-muted/20 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-display text-sm uppercase tracking-[0.12em]">{task.name}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock3 className="size-3.5" />
                  {formatTime(task.nextFire)}
                </p>
              </div>

              <Badge variant="outline" className={cn("rounded-md uppercase", badgeTone[task.type] ?? "")}>{task.type}</Badge>
            </div>
          </article>
        ))}
      </div>

      <Button asChild size="sm" className="mt-4 w-full font-display uppercase tracking-[0.14em]">
        <Link href="/calendar">Open Calendar View</Link>
      </Button>
    </section>
  );
}

function formatTime(timestamp?: number) {
  if (!timestamp) {
    return "No next fire";
  }

  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
