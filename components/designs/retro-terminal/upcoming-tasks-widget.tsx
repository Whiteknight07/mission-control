"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "convex/react";
import { CalendarClock, Loader2 } from "lucide-react";

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
      <section className="rounded border border-[#33ff33]/30 bg-black p-4 font-mono text-[#33ff33]">
        <div className="mb-3 h-3 w-32 animate-pulse bg-[#33ff33]/20" />
        <div className="space-y-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded border border-[#33ff33]/20 bg-[#33ff33]/5" />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-[#33ff33]/50">
          <Loader2 className="size-3 animate-spin" />
          Loading crontab...
        </div>
      </section>
    );
  }

  return (
    <section className="rounded border border-[#33ff33]/30 bg-black p-4 font-mono text-[#33ff33]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] text-[#33ff33]/50">$ crontab -l | head -5</p>
          <h2 className="mt-1 text-sm">upcoming</h2>
        </div>
        <CalendarClock className="size-5 text-[#33ff33]/70" />
      </div>

      <div className="mt-4 space-y-1">
        {tasks.length === 0 && (
          <div className="rounded border border-dashed border-[#33ff33]/30 p-3 text-center text-xs text-[#33ff33]/50">
            # no entries
          </div>
        )}

        {tasks.map((task) => {
          const color = task.type === "cron" ? "#33ff33" : task.type === "reminder" ? "#ffff33" : "#33ffff";
          return (
            <article
              key={task._id}
              className="rounded border border-[#33ff33]/20 bg-[#33ff33]/5 p-2 text-xs transition-all hover:border-[#33ff33]/50"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p>{task.name}</p>
                  <p className="mt-0.5 text-[10px] text-[#33ff33]/50">{formatTime(task.nextFire)}</p>
                </div>
                <span
                  className="rounded px-1.5 py-0.5 text-[9px] text-black"
                  style={{ backgroundColor: color }}
                >
                  {task.type}
                </span>
              </div>
            </article>
          );
        })}
      </div>

      <Link
        href="/calendar"
        className="mt-4 flex w-full items-center justify-center rounded border border-[#33ff33]/30 py-2 text-xs transition-all hover:border-[#33ff33] hover:bg-[#33ff33]/10"
      >
        $ cd /calendar <span className="ml-1 animate-pulse">_</span>
      </Link>

      {/* Scanline */}
      <div className="pointer-events-none absolute inset-0 rounded bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.05)_50%)] bg-[length:100%_4px]" />
    </section>
  );
}

function formatTime(timestamp?: number) {
  if (!timestamp) return "null";
  return new Date(timestamp).toISOString().replace("T", " ").slice(0, 16);
}
