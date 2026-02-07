"use client";

import { useEffect, useMemo, useState } from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { ChevronLeft, ChevronRight, DatabaseZap, Loader2, X } from "lucide-react";

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

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

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
    const s = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const e = addDays(weekStart, 6).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${s} – ${e}`;
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
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-neutral-800 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-light text-white">{weekLabel}</h2>
          <p className="mt-1 text-xs text-neutral-500">Week view</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { setWeekStart((c) => addDays(c, -7)); setMobileOffset(0); }} className="flex items-center gap-1 border border-neutral-800 px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-900 hover:text-white">
            <ChevronLeft className="size-3" /> Prev
          </button>
          <button onClick={() => { setWeekStart(startOfWeek(new Date())); setMobileOffset(getMobileOffsetForDate(new Date())); }} className="border border-neutral-800 px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-900 hover:text-white">
            Today
          </button>
          <button onClick={() => { setWeekStart((c) => addDays(c, 7)); setMobileOffset(0); }} className="flex items-center gap-1 border border-neutral-800 px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-900 hover:text-white">
            Next <ChevronRight className="size-3" />
          </button>
          <button onClick={handleSeed} disabled={seedState === "pending"} className="flex items-center gap-1 bg-white px-3 py-1.5 text-xs text-black disabled:opacity-50">
            {seedState === "pending" ? <Loader2 className="size-3 animate-spin" /> : <DatabaseZap className="size-3" />}
            Seed
          </button>
        </div>
      </div>

      {/* Mobile 3-day */}
      <div className="border border-neutral-800 p-2 md:hidden">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-neutral-500">3-day view</span>
          <div className="flex gap-1">
            <button onClick={() => setMobileOffset((v) => Math.max(0, v - 1))} disabled={mobileOffset === 0} className="border border-neutral-800 p-1 text-neutral-500 disabled:opacity-30">
              <ChevronLeft className="size-3" />
            </button>
            <button onClick={() => setMobileOffset((v) => Math.min(4, v + 1))} disabled={mobileOffset >= 4} className="border border-neutral-800 p-1 text-neutral-500 disabled:opacity-30">
              <ChevronRight className="size-3" />
            </button>
          </div>
        </div>
        <PlannerBoard days={mobileDays} groupedTasks={groupedTasks} nowMs={nowMs} onSelectTask={(t) => setSelectedTaskId(t._id)} selectedTaskId={selectedTaskId ?? undefined} />
      </div>

      {/* Desktop 7-day */}
      <div className="hidden md:block">
        <PlannerBoard days={weekDays} groupedTasks={groupedTasks} nowMs={nowMs} onSelectTask={(t) => setSelectedTaskId(t._id)} selectedTaskId={selectedTaskId ?? undefined} />
      </div>

      <TaskDetailPanel task={selectedTask} onClose={() => setSelectedTaskId(null)} />
    </section>
  );
}

function PlannerBoard({ days, groupedTasks, nowMs, onSelectTask, selectedTaskId }: { days: Date[]; groupedTasks: Map<string, ScheduledTask[]>; nowMs: number; onSelectTask: (task: ScheduledTask) => void; selectedTaskId?: ScheduledTask["_id"] }) {
  const now = new Date(nowMs);

  return (
    <div className="overflow-hidden border border-neutral-800">
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Header */}
          <div className="grid border-b border-neutral-800" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(100px, 1fr))` }}>
            <div className="border-r border-neutral-800 p-2 text-right text-[10px] text-neutral-600" />
            {days.map((day) => {
              const isToday = dayKey(day) === dayKey(now);
              return (
                <div key={dayKey(day)} className={cn("border-r border-neutral-800 p-2", isToday && "bg-white text-black")}>
                  <p className="text-xs font-medium">{day.toLocaleDateString("en-US", { weekday: "short" })}</p>
                  <p className="text-[10px] opacity-60">{day.getDate()}</p>
                </div>
              );
            })}
          </div>

          {/* Grid */}
          <div className="grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(100px, 1fr))` }}>
            <div className="relative border-r border-neutral-800" style={{ height: `${DAY_HEIGHT}px` }}>
              {HOURS.map((hour) => (
                <div key={hour} className="absolute left-0 right-0 border-t border-neutral-900 text-right text-[9px] text-neutral-700" style={{ top: `${hour * SLOT_HEIGHT}px` }}>
                  <span className="mr-1">{hour.toString().padStart(2, "0")}</span>
                </div>
              ))}
            </div>

            {days.map((day) => {
              const key = dayKey(day);
              const dayTasks = groupedTasks.get(key) ?? [];
              const isToday = key === dayKey(now);
              const nowTop = isToday ? minuteToOffset(now.getHours() * 60 + now.getMinutes()) : null;

              return (
                <div key={key} className={cn("relative border-r border-neutral-800", isToday && "bg-neutral-900/50")} style={{ height: `${DAY_HEIGHT}px` }}>
                  {HOURS.map((hour) => (<div key={hour} className="absolute left-0 right-0 border-t border-neutral-900" style={{ top: `${hour * SLOT_HEIGHT}px` }} />))}

                  {dayTasks.map((task) => {
                    if (!task.nextFire) return null;
                    const startDate = new Date(task.nextFire);
                    const minutes = startDate.getHours() * 60 + startDate.getMinutes();
                    const top = minuteToOffset(minutes);
                    const height = minutesToHeight(getTaskDuration(task));

                    return (
                      <button key={task._id} type="button" onClick={() => onSelectTask(task)}
                        className={cn("absolute left-0.5 right-0.5 overflow-hidden border-l-2 bg-neutral-900 px-1 py-0.5 text-left text-[10px] transition-all hover:bg-neutral-800", !task.enabled && "opacity-40", selectedTaskId === task._id && "ring-1 ring-white")}
                        style={{ top: `${top}px`, height: `${height}px`, borderLeftColor: task.type === "cron" ? "#fff" : task.type === "reminder" ? "#888" : "#555" }}>
                        <p className="truncate text-white">{task.name}</p>
                        <p className="text-neutral-500">{startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                      </button>
                    );
                  })}

                  {nowTop !== null && (
                    <div className="pointer-events-none absolute left-0 right-0 z-10" style={{ top: `${nowTop}px` }}>
                      <div className="absolute -left-0.5 top-0 size-2 bg-white" />
                      <div className="h-px bg-white" />
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
    <div className={cn("fixed inset-0 z-50 transition", isOpen ? "pointer-events-auto" : "pointer-events-none")}>
      <button type="button" onClick={onClose} className={cn("absolute inset-0 bg-black/80 transition-opacity", isOpen ? "opacity-100" : "opacity-0")} />
      <aside className={cn("absolute inset-y-0 right-0 w-full max-w-sm border-l border-neutral-800 bg-neutral-950 p-6 transition-transform", isOpen ? "translate-x-0" : "translate-x-full")}>
        {task && (
          <div className="flex h-full flex-col">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="text-xs text-neutral-500">Task</p>
                <h3 className="mt-1 text-lg font-light text-white">{task.name}</h3>
              </div>
              <button onClick={onClose} className="text-neutral-500 hover:text-white"><X className="size-5" /></button>
            </div>

            <div className="space-y-4">
              {[
                { label: "Type", value: task.type },
                { label: "Schedule", value: task.schedule },
                { label: "Enabled", value: task.enabled ? "Yes" : "No" },
                { label: "Last run", value: formatDateTime(task.lastRun) },
                { label: "Next fire", value: formatDateTime(task.nextFire) },
              ].map((row) => (
                <div key={row.label} className="border-b border-neutral-800 pb-3">
                  <p className="text-xs text-neutral-600">{row.label}</p>
                  <p className="mt-1 text-sm text-white">{row.value}</p>
                </div>
              ))}

              <div className="border-b border-neutral-800 pb-3">
                <p className="text-xs text-neutral-600">Config</p>
                <pre className="mt-2 max-h-40 overflow-auto text-xs text-neutral-400">{formatConfig(task.config)}</pre>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <section className="space-y-6">
      <div className="border-b border-neutral-800 pb-4">
        <div className="h-6 w-32 animate-pulse bg-neutral-900" />
      </div>
      <div className="border border-neutral-800 p-4">
        <div className="h-48 animate-pulse bg-neutral-900" />
      </div>
      <div className="flex items-center gap-2 py-4 text-xs text-neutral-600">
        <Loader2 className="size-3 animate-spin" /> Loading
      </div>
    </section>
  );
}

// Utilities
function dayKey(date: Date) { return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`; }
function addDays(base: Date, days: number) { const next = new Date(base); next.setDate(next.getDate() + days); return next; }
function startOfWeek(date: Date) { const start = new Date(date); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); return start; }
function getTaskDuration(task: ScheduledTask) { const config = typeof task.config === "object" && task.config ? task.config : null; const val = config && "durationMinutes" in config ? (config as Record<string, unknown>).durationMinutes : null; if (typeof val === "number") return Math.min(Math.max(val, 15), 180); return task.type === "recurring" ? 60 : task.type === "cron" ? 40 : 30; }
function formatDateTime(ts?: number) { if (!ts) return "—"; return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
function formatConfig(config: unknown) { if (!config) return "—"; try { return JSON.stringify(config, null, 2); } catch { return String(config); } }
function minuteToOffset(minutes: number) { return (minutes / 60) * SLOT_HEIGHT; }
function minutesToHeight(minutes: number) { return Math.max((minutes / 60) * SLOT_HEIGHT, 20); }
function getMobileOffsetForDate(date: Date) { const index = (date.getDay() + 6) % 7; return index <= 2 ? 0 : index <= 5 ? 3 : 4; }
