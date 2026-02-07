"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "convex/react";
import { CalendarClock, Clock3, Loader2 } from "lucide-react";

import { api } from "@/convex/_generated/api";

const badgeTone: Record<string, string> = {
  cron: "#00ff00",
  reminder: "#ffff00",
  recurring: "#00ffff",
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
      <section className="border-4 border-[#00ffff] bg-black p-5">
        <div className="mb-4 h-5 w-40 animate-pulse bg-[#00ffff]/30" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse border-l-2 border-[#00ffff]/30 bg-white/5" />
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-[#00ffff]">
          <Loader2 className="size-3 animate-spin" />
          <span className="font-black uppercase tracking-widest">LOADING...</span>
        </div>
      </section>
    );
  }

  return (
    <section className="border-4 border-[#00ffff] bg-black p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#00ffff]">SCHEDULER</p>
          <h2 className="mt-1 text-xl font-black uppercase text-white">UPCOMING</h2>
        </div>
        <CalendarClock className="size-6 text-[#00ffff]" />
      </div>

      <div className="mt-4 space-y-2">
        {tasks.length === 0 && (
          <div className="border-2 border-dashed border-white/20 p-4 text-center text-xs text-white/50">
            NO_TASKS_FOUND
          </div>
        )}

        {tasks.map((task) => (
          <article
            key={task._id}
            className="border-l-4 bg-white/5 p-3"
            style={{ borderLeftColor: badgeTone[task.type] ?? "#ffffff" }}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-black uppercase text-white">{task.name}</p>
                <p className="mt-1 flex items-center gap-1 text-[10px] text-white/50">
                  <Clock3 className="size-3" />
                  {formatTime(task.nextFire)}
                </p>
              </div>
              <span
                className="px-1.5 py-0.5 text-[9px] font-black text-black"
                style={{ backgroundColor: badgeTone[task.type] ?? "#ffffff" }}
              >
                {task.type.toUpperCase()}
              </span>
            </div>
          </article>
        ))}
      </div>

      <Link
        href="/calendar"
        className="mt-4 flex w-full items-center justify-center border-2 border-[#00ffff] py-2 text-[10px] font-black uppercase tracking-widest text-[#00ffff] transition-colors hover:bg-[#00ffff] hover:text-black"
      >
        OPEN_CALENDAR
      </Link>
    </section>
  );
}

function formatTime(timestamp?: number) {
  if (!timestamp) return "NO_NEXT_FIRE";
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
