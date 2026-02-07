"use client";

import { useEffect, useMemo, useState } from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import {
  ChevronLeft,
  ChevronRight,
  DatabaseZap,
  Loader2,
  X,
} from "lucide-react";

import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

type ScheduledTask = Doc<"scheduledTasks">;
type SeedState = "idle" | "pending" | "created" | "skipped" | "error";

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const SLOT_HEIGHT = 48;
const DAY_HEIGHT = HOURS.length * SLOT_HEIGHT;

export function CalendarGrid() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [mobileOffset, setMobileOffset] = useState(() => getMobileOffsetForDate(new Date()));
  const [selectedTaskId, setSelectedTaskId] = useState<ScheduledTask["_id"] | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [seedState, setSeedState] = useState<SeedState>("idle");

  const seedTasks = useMutation(api.scheduledTasks.seedTasks);
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);

  const tasks = useQuery(api.scheduledTasks.listInWindow, {
    startMs: weekStart.getTime(),
    endMs: weekEnd.getTime(),
    limit: 500,
  });

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const groupedTasks = useMemo(() => {
    const map = new Map<string, ScheduledTask[]>();
    for (const day of weekDays) map.set(dayKey(day), []);
    for (const task of tasks ?? []) {
      if (!task.nextFire) continue;
      const key = dayKey(new Date(task.nextFire));
      if (map.has(key)) map.get(key)!.push(task);
    }
    for (const day of weekDays) {
      map.get(dayKey(day))!.sort((a, b) => (a.nextFire ?? 0) - (b.nextFire ?? 0));
    }
    return map;
  }, [tasks, weekDays]);

  const selectedTask = useMemo(() => {
    if (!selectedTaskId || !tasks) return null;
    return tasks.find((t) => t._id === selectedTaskId) ?? null;
  }, [selectedTaskId, tasks]);

  const weekLabel = useMemo(() => {
    const s = weekStart.toISOString().split("T")[0];
    const e = addDays(weekStart, 6).toISOString().split("T")[0];
    return `${s} → ${e}`;
  }, [weekStart]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedTaskId(null);
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  const mobileDays = weekDays.slice(mobileOffset, mobileOffset + 3);

  const handleSeed = async () => {
    setSeedState("pending");
    try {
      const result = await seedTasks({});
      setSeedState(result.skipped ? "skipped" : "created");
      window.setTimeout(() => setSeedState("idle"), 2500);
    } catch {
      setSeedState("error");
      window.setTimeout(() => setSeedState("idle"), 2500);
    }
  };

  if (!tasks) return <CalendarSkeleton />;

  return (
    <section className="space-y-3 font-mono text-[#33ff33]">
      {/* Header */}
      <div className="rounded border border-[#33ff33]/30 bg-black p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] text-[#33ff33]/50">$ crontab -l # week view</p>
            <h2 className="mt-1 text-sm">{weekLabel}</h2>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              onClick={() => { setWeekStart((c) => addDays(c, -7)); setMobileOffset(0); }}
              className="flex items-center gap-1 rounded border border-[#33ff33]/30 px-2 py-1 hover:border-[#33ff33] hover:bg-[#33ff33]/10"
            >
              <ChevronLeft className="size-3" /> prev
            </button>
            <button
              onClick={() => { setWeekStart(startOfWeek(new Date())); setMobileOffset(getMobileOffsetForDate(new Date())); }}
              className="rounded border border-[#33ff33]/30 px-2 py-1 hover:border-[#33ff33] hover:bg-[#33ff33]/10"
            >
              today
            </button>
            <button
              onClick={() => { setWeekStart((c) => addDays(c, 7)); setMobileOffset(0); }}
              className="flex items-center gap-1 rounded border border-[#33ff33]/30 px-2 py-1 hover:border-[#33ff33] hover:bg-[#33ff33]/10"
            >
              next <ChevronRight className="size-3" />
            </button>
            <button
              onClick={handleSeed}
              disabled={seedState === "pending"}
              className="flex items-center gap-1 rounded bg-[#33ff33] px-2 py-1 text-black disabled:opacity-50"
            >
              {seedState === "pending" ? <Loader2 className="size-3 animate-spin" /> : <DatabaseZap className="size-3" />}
              seed
            </button>
          </div>
        </div>

        <div className="mt-2 flex gap-3 text-[10px] text-[#33ff33]/50">
          <span>[cron]=green</span>
          <span>[reminder]=yellow</span>
          <span>[recurring]=cyan</span>
        </div>
      </div>

      {/* Mobile 3-day */}
      <div className="rounded border border-[#33ff33]/30 bg-black p-2 md:hidden">
        <div className="mb-2 flex items-center justify-between text-[10px]">
          <span className="text-[#33ff33]/50"># 3-day window</span>
          <div className="flex gap-1">
            <button
              onClick={() => setMobileOffset((v) => Math.max(0, v - 1))}
              disabled={mobileOffset === 0}
              className="rounded border border-[#33ff33]/30 p-1 disabled:opacity-30"
            >
              <ChevronLeft className="size-3" />
            </button>
            <button
              onClick={() => setMobileOffset((v) => Math.min(4, v + 1))}
              disabled={mobileOffset >= 4}
              className="rounded border border-[#33ff33]/30 p-1 disabled:opacity-30"
            >
              <ChevronRight className="size-3" />
            </button>
          </div>
        </div>
        <PlannerBoard
          days={mobileDays}
          groupedTasks={groupedTasks}
          nowMs={nowMs}
          onSelectTask={(t) => setSelectedTaskId(t._id)}
          selectedTaskId={selectedTaskId ?? undefined}
        />
      </div>

      {/* Desktop 7-day */}
      <div className="hidden md:block">
        <PlannerBoard
          days={weekDays}
          groupedTasks={groupedTasks}
          nowMs={nowMs}
          onSelectTask={(t) => setSelectedTaskId(t._id)}
          selectedTaskId={selectedTaskId ?? undefined}
        />
      </div>

      <TaskDetailPanel task={selectedTask} onClose={() => setSelectedTaskId(null)} />

      {/* CRT scanline */}
      <div className="pointer-events-none fixed inset-0 z-[100] bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.05)_50%)] bg-[length:100%_4px]" />
    </section>
  );
}

function PlannerBoard({
  days,
  groupedTasks,
  nowMs,
  onSelectTask,
  selectedTaskId,
}: {
  days: Date[];
  groupedTasks: Map<string, ScheduledTask[]>;
  nowMs: number;
  onSelectTask: (task: ScheduledTask) => void;
  selectedTaskId?: ScheduledTask["_id"];
}) {
  const now = new Date(nowMs);

  return (
    <div className="overflow-hidden rounded border border-[#33ff33]/30">
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Header */}
          <div
            className="grid border-b border-[#33ff33]/20"
            style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(120px, 1fr))` }}
          >
            <div className="border-r border-[#33ff33]/20 bg-[#33ff33]/5 p-2 text-right text-[9px] text-[#33ff33]/50">
              UTC
            </div>
            {days.map((day) => {
              const isToday = dayKey(day) === dayKey(now);
              return (
                <div
                  key={dayKey(day)}
                  className={cn("border-r border-[#33ff33]/20 p-2", isToday && "bg-[#33ff33]/10")}
                >
                  <p className="text-[10px]">{day.toLocaleDateString("en-US", { weekday: "short" })}</p>
                  <p className="text-[9px] text-[#33ff33]/50">{day.toISOString().split("T")[0]}</p>
                </div>
              );
            })}
          </div>

          {/* Grid */}
          <div
            className="grid bg-black"
            style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(120px, 1fr))` }}
          >
            <div className="relative border-r border-[#33ff33]/20" style={{ height: `${DAY_HEIGHT}px` }}>
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="absolute left-0 right-0 border-t border-[#33ff33]/10 text-right text-[8px] text-[#33ff33]/40"
                  style={{ top: `${hour * SLOT_HEIGHT}px` }}
                >
                  <span className="mr-1">{String(hour).padStart(2, "0")}:00</span>
                </div>
              ))}
            </div>

            {days.map((day) => {
              const key = dayKey(day);
              const dayTasks = groupedTasks.get(key) ?? [];
              const isToday = key === dayKey(now);
              const nowTop = isToday ? minuteToOffset(now.getHours() * 60 + now.getMinutes()) : null;

              return (
                <div
                  key={key}
                  className={cn("relative border-r border-[#33ff33]/20", isToday && "bg-[#33ff33]/5")}
                  style={{ height: `${DAY_HEIGHT}px` }}
                >
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="absolute left-0 right-0 border-t border-[#33ff33]/10"
                      style={{ top: `${hour * SLOT_HEIGHT}px` }}
                    />
                  ))}

                  {dayTasks.map((task) => {
                    if (!task.nextFire) return null;
                    const startDate = new Date(task.nextFire);
                    const minutes = startDate.getHours() * 60 + startDate.getMinutes();
                    const top = minuteToOffset(minutes);
                    const height = minutesToHeight(getTaskDuration(task));
                    const color = task.type === "cron" ? "#33ff33" : task.type === "reminder" ? "#ffff33" : "#33ffff";

                    return (
                      <button
                        key={task._id}
                        type="button"
                        onClick={() => onSelectTask(task)}
                        className={cn(
                          "absolute left-0.5 right-0.5 overflow-hidden rounded-sm border-l-2 bg-black/80 px-1 py-0.5 text-left text-[9px] transition-all hover:bg-[#33ff33]/10",
                          !task.enabled && "opacity-40",
                          selectedTaskId === task._id && "ring-1 ring-[#33ff33]"
                        )}
                        style={{ top: `${top}px`, height: `${height}px`, borderLeftColor: color, color }}
                      >
                        <p className="truncate">{task.name}</p>
                        <p className="text-[8px] opacity-70">
                          {startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </button>
                    );
                  })}

                  {nowTop !== null && (
                    <div className="pointer-events-none absolute left-0 right-0 z-10" style={{ top: `${nowTop}px` }}>
                      <div className="absolute -left-0.5 top-0 size-2 bg-[#ff3333]" />
                      <div className="h-px bg-[#ff3333] shadow-[0_0_8px_#ff3333]" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskDetailPanel({ task, onClose }: { task: ScheduledTask | null; onClose: () => void }) {
  const isOpen = Boolean(task);

  return (
    <div className={cn("fixed inset-0 z-50 font-mono transition", isOpen ? "pointer-events-auto" : "pointer-events-none")}>
      <button
        type="button"
        onClick={onClose}
        className={cn("absolute inset-0 bg-black/80 transition-opacity", isOpen ? "opacity-100" : "opacity-0")}
      />
      <aside
        className={cn(
          "absolute inset-y-0 right-0 w-full max-w-sm border-l border-[#33ff33]/30 bg-black p-4 transition-transform",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {task && (
          <div className="flex h-full flex-col text-[#33ff33]">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-[10px] text-[#33ff33]/50">$ cat task.json</p>
                <h3 className="mt-1 text-sm">{task.name}</h3>
              </div>
              <button onClick={onClose} className="p-1 text-[#33ff33]/70 hover:text-[#33ff33]">
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {[
                { key: "type", val: task.type },
                { key: "schedule", val: task.schedule },
                { key: "enabled", val: task.enabled ? "true" : "false" },
                { key: "lastRun", val: formatDateTime(task.lastRun) },
                { key: "nextFire", val: formatDateTime(task.nextFire) },
              ].map((row) => (
                <div key={row.key} className="rounded border border-[#33ff33]/20 bg-[#33ff33]/5 p-2">
                  <span className="text-[#33ff33]/50">{row.key}: </span>
                  <span>{row.val}</span>
                </div>
              ))}

              <div className="rounded border border-[#33ff33]/20 bg-[#33ff33]/5 p-2">
                <p className="mb-1 text-[#33ff33]/50">config:</p>
                <pre className="max-h-40 overflow-auto text-[10px]">{formatConfig(task.config)}</pre>
              </div>
            </div>
          </div>
        )}
        {/* Panel scanline */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px]" />
      </aside>
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <section className="space-y-3 font-mono text-[#33ff33]">
      <div className="rounded border border-[#33ff33]/20 bg-black p-3">
        <div className="h-3 w-40 animate-pulse bg-[#33ff33]/20" />
        <div className="mt-2 h-4 w-64 animate-pulse bg-[#33ff33]/20" />
      </div>
      <div className="rounded border border-[#33ff33]/20 bg-black p-3">
        <div className="h-48 animate-pulse bg-[#33ff33]/10" />
      </div>
      <div className="flex items-center justify-center gap-2 rounded border border-[#33ff33]/20 p-3 text-xs text-[#33ff33]/50">
        <Loader2 className="size-3 animate-spin" />
        Loading crontab...
      </div>
    </section>
  );
}

// Utilities
function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

function getTaskDuration(task: ScheduledTask) {
  const config = typeof task.config === "object" && task.config !== null ? task.config : null;
  const configured = config && "durationMinutes" in config ? (config as Record<string, unknown>).durationMinutes : null;
  if (typeof configured === "number") return Math.min(Math.max(configured, 15), 180);
  return task.type === "recurring" ? 60 : task.type === "cron" ? 40 : 30;
}

function formatDateTime(ts?: number) {
  if (!ts) return "null";
  return new Date(ts).toISOString().replace("T", " ").slice(0, 19);
}

function formatConfig(config: unknown) {
  if (!config) return "{}";
  try { return JSON.stringify(config, null, 2); } catch { return String(config); }
}

function minuteToOffset(minutes: number) {
  return (minutes / 60) * SLOT_HEIGHT;
}

function minutesToHeight(minutes: number) {
  return Math.max((minutes / 60) * SLOT_HEIGHT, 20);
}

function getMobileOffsetForDate(date: Date) {
  const index = (date.getDay() + 6) % 7;
  return index <= 2 ? 0 : index <= 5 ? 3 : 4;
}
