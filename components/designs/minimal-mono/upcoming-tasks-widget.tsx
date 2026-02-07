"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "convex/react";
import { Clock3, Loader2 } from "lucide-react";

import { api } from "@/convex/_generated/api";

export function UpcomingTasksWidget() {
  const [fromMs] = useState(() => Date.now());

  const tasks = useQuery(api.scheduledTasks.listUpcoming, {
    enabledOnly: true,
    limit: 5,
    fromMs,
  });

  if (!tasks) {
    return (
      <section className="border border-neutral-800 p-6">
        <div className="mb-4 h-4 w-32 animate-pulse bg-neutral-900" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse bg-neutral-900" />
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-neutral-600">
          <Loader2 className="size-3 animate-spin" />
          Loading
        </div>
      </section>
    );
  }

  return (
    <section className="border border-neutral-800 p-6">
      <div className="mb-4">
        <p className="text-xs text-neutral-500">Scheduler</p>
        <h2 className="mt-1 text-lg font-light text-white">Upcoming</h2>
      </div>

      <div className="divide-y divide-neutral-800/50">
        {tasks.length === 0 && (
          <p className="py-4 text-center text-xs text-neutral-500">No tasks</p>
        )}

        {tasks.map((task) => (
          <article key={task._id} className="py-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm text-white">{task.name}</p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-neutral-500">
                  <Clock3 className="size-3" />
                  {formatTime(task.nextFire)}
                </p>
              </div>
              <span className="text-[10px] text-neutral-600">{task.type}</span>
            </div>
          </article>
        ))}
      </div>

      <Link
        href="/calendar"
        className="mt-4 flex w-full items-center justify-center border border-neutral-800 py-2.5 text-xs text-neutral-400 transition-colors hover:bg-neutral-900 hover:text-white"
      >
        View calendar
      </Link>
    </section>
  );
}

function formatTime(timestamp?: number) {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
