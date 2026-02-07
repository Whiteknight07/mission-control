"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "convex/react";
import { CalendarClock, Clock3, Loader2 } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

const badgeTone: Record<string, string> = {
  cron: "from-emerald-400 to-teal-500",
  reminder: "from-amber-400 to-orange-500",
  recurring: "from-sky-400 to-blue-500",
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
      <section className="rounded-3xl border border-white/20 bg-white/10 p-6 shadow-xl backdrop-blur-xl">
        <div className="mb-4 h-5 w-40 animate-pulse rounded-full bg-white/10" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2 text-sm text-white/40">
          <Loader2 className="size-4 animate-spin" />
          Loading...
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-white/20 bg-white/10 p-6 shadow-xl backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-white/50">Scheduler</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Upcoming</h2>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 p-2.5 shadow-lg shadow-violet-500/30">
          <CalendarClock className="size-5 text-white" />
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {tasks.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/20 p-4 text-center text-sm text-white/40">
            No upcoming tasks
          </div>
        )}

        {tasks.map((task) => (
          <article
            key={task._id}
            className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 transition-all hover:bg-white/10"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-white">{task.name}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-white/50">
                  <Clock3 className="size-3.5" />
                  {formatTime(task.nextFire)}
                </p>
              </div>
              <span
                className={cn(
                  "rounded-xl bg-gradient-to-r px-2 py-0.5 text-[10px] font-medium text-white",
                  badgeTone[task.type] ?? "from-gray-400 to-gray-500"
                )}
              >
                {task.type}
              </span>
            </div>
          </article>
        ))}
      </div>

      <Link
        href="/calendar"
        className="mt-5 flex w-full items-center justify-center rounded-2xl bg-white/10 py-3 text-sm font-medium text-white/80 transition-all hover:bg-white/20 hover:text-white"
      >
        View Calendar
      </Link>
    </section>
  );
}

function formatTime(timestamp?: number) {
  if (!timestamp) return "Not scheduled";
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
