"use client";

import { useEffect, useMemo, useState } from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock3,
  DatabaseZap,
  Loader2,
  Timer,
  X,
} from "lucide-react";

import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

type ScheduledTask = Doc<"scheduledTasks">;
type NavDirection = "idle" | "forward" | "back";
type SeedState = "idle" | "pending" | "created" | "skipped" | "error";

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const SLOT_HEIGHT = 56;
const DAY_HEIGHT = HOURS.length * SLOT_HEIGHT;

const typeTone: Record<string, { gradient: string; bg: string }> = {
  cron: { gradient: "from-emerald-400 to-teal-500", bg: "bg-emerald-500/20" },
  reminder: { gradient: "from-amber-400 to-orange-500", bg: "bg-amber-500/20" },
  recurring: { gradient: "from-sky-400 to-blue-500", bg: "bg-sky-500/20" },
};

export function CalendarGrid() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [navDirection, setNavDirection] = useState<NavDirection>("idle");
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
    () => Array.from({ length: 7 }, (_, dayIndex) => addDays(weekStart, dayIndex)),
    [weekStart]
  );

  const groupedTasks = useMemo(() => {
    const map = new Map<string, ScheduledTask[]>();
    for (const day of weekDays) map.set(dayKey(day), []);
    for (const task of tasks ?? []) {
      if (!task.nextFire) continue;
      const key = dayKey(new Date(task.nextFire));
      if (!map.has(key)) continue;
      map.get(key)!.push(task);
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

  const isCurrentWeek = useMemo(() => dayKey(startOfWeek(new Date())) === dayKey(weekStart), [weekStart]);

  const weekLabel = useMemo(() => {
    const s = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const e = addDays(weekStart, 6).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return `${s} - ${e}`;
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

  const handlePrevWeek = () => {
    setNavDirection("back");
    setWeekStart((c) => addDays(c, -7));
    setMobileOffset(0);
  };

  const handleNextWeek = () => {
    setNavDirection("forward");
    setWeekStart((c) => addDays(c, 7));
    setMobileOffset(0);
  };

  const handleToday = () => {
    setNavDirection("idle");
    setWeekStart(startOfWeek(new Date()));
    setMobileOffset(getMobileOffsetForDate(new Date()));
  };

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
    <section className="space-y-4">
      {/* Header */}
      <div className="rounded-3xl bg-gradient-to-br from-violet-950/50 to-fuchsia-950/30 p-5 shadow-xl shadow-violet-500/10 backdrop-blur-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-medium text-violet-400/80">Planning Window</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">{weekLabel}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {["Prev", "Today", "Next"].map((label, i) => (
              <button
                key={label}
                onClick={[handlePrevWeek, handleToday, handleNextWeek][i]}
                className="flex items-center gap-1 rounded-xl bg-white/5 px-4 py-2 text-sm font-medium text-violet-300 transition-all hover:bg-white/10"
              >
                {i === 0 && <ChevronLeft className="size-4" />}
                {label}
                {i === 2 && <ChevronRight className="size-4" />}
              </button>
            ))}
            <button
              onClick={handleSeed}
              disabled={seedState === "pending"}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-violet-500/30 transition-all hover:shadow-violet-500/40 disabled:opacity-50"
            >
              {seedState === "pending" ? <Loader2 className="size-4 animate-spin" /> : <DatabaseZap className="size-4" />}
              Seed Tasks
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
          {Object.entries(typeTone).map(([type, { gradient }]) => (
            <span key={type} className="flex items-center gap-1.5">
              <span className={cn("size-3 rounded-full bg-gradient-to-r", gradient)} />
              <span className="capitalize text-violet-300/80">{type}</span>
            </span>
          ))}
          <span className="flex items-center gap-1 text-violet-400/60">
            <Timer className="size-3.5" />
            {isCurrentWeek ? "Current week" : "Other week"}
          </span>
        </div>
      </div>

      {/* Mobile view */}
      <div className="rounded-3xl bg-gradient-to-br from-violet-950/50 to-fuchsia-950/30 p-4 shadow-xl md:hidden">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-medium text-violet-300">3-Day View</span>
          <div className="flex gap-1">
            <button
              onClick={() => setMobileOffset((v) => Math.max(0, v - 1))}
              disabled={mobileOffset === 0}
              className="rounded-lg bg-white/5 p-1.5 text-violet-300 disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={() => setMobileOffset((v) => Math.min(4, v + 1))}
              disabled={mobileOffset >= 4}
              className="rounded-lg bg-white/5 p-1.5 text-violet-300 disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
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

      {/* Desktop view */}
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
    <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-violet-950/50 to-fuchsia-950/30 shadow-xl shadow-violet-500/10">
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          {/* Header */}
          <div
            className="grid border-b border-white/10"
            style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(140px, 1fr))` }}
          >
            <div className="border-r border-white/10 p-3 text-right text-[10px] font-medium text-violet-400/60">
              Time
            </div>
            {days.map((day) => {
              const isToday = dayKey(day) === dayKey(now);
              return (
                <div
                  key={dayKey(day)}
                  className={cn("border-r border-white/10 p-3", isToday && "bg-violet-500/10")}
                >
                  <p className="text-xs font-semibold text-violet-300">
                    {day.toLocaleDateString("en-US", { weekday: "short" })}
                  </p>
                  <p className="text-[11px] text-violet-400/60">
                    {day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Grid */}
          <div
            className="grid"
            style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(140px, 1fr))` }}
          >
            <div className="relative border-r border-white/10" style={{ height: `${DAY_HEIGHT}px` }}>
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="absolute left-0 right-0 border-t border-white/5 text-right text-[10px] text-violet-400/50"
                  style={{ top: `${hour * SLOT_HEIGHT}px` }}
                >
                  <span className="mr-2">{formatHour(hour)}</span>
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
                  className={cn("relative border-r border-white/10", isToday && "bg-violet-500/5")}
                  style={{ height: `${DAY_HEIGHT}px` }}
                >
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="absolute left-0 right-0 border-t border-white/5"
                      style={{ top: `${hour * SLOT_HEIGHT}px` }}
                    />
                  ))}

                  {dayTasks.map((task) => {
                    if (!task.nextFire) return null;
                    const startDate = new Date(task.nextFire);
                    const minutes = startDate.getHours() * 60 + startDate.getMinutes();
                    const top = minuteToOffset(minutes);
                    const height = minutesToHeight(getTaskDuration(task));
                    const tone = typeTone[task.type] ?? { gradient: "from-gray-400 to-gray-500", bg: "bg-gray-500/20" };

                    return (
                      <button
                        key={task._id}
                        type="button"
                        onClick={() => onSelectTask(task)}
                        className={cn(
                          "absolute left-1 right-1 overflow-hidden rounded-xl p-2 text-left transition-all hover:scale-[1.02]",
                          tone.bg,
                          !task.enabled && "opacity-50",
                          selectedTaskId === task._id && "ring-2 ring-white/50"
                        )}
                        style={{ top: `${top}px`, height: `${height}px` }}
                      >
                        <p className="truncate text-[10px] font-semibold text-white">{task.name}</p>
                        <p className="text-[10px] text-white/60">
                          {startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                        <span className={cn("mt-1 inline-block rounded-full px-1.5 py-0.5 text-[8px] font-medium text-white bg-gradient-to-r", tone.gradient)}>
                          {task.type}
                        </span>
                      </button>
                    );
                  })}

                  {nowTop !== null && (
                    <div className="pointer-events-none absolute left-0 right-0 z-10" style={{ top: `${nowTop}px` }}>
                      <div className="absolute -left-1 top-0 size-2.5 rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-500 shadow-lg shadow-violet-500/50" />
                      <div className="h-0.5 bg-gradient-to-r from-violet-400 to-fuchsia-500" />
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
  const tone = task ? typeTone[task.type] : undefined;

  return (
    <div className={cn("fixed inset-0 z-50 transition", isOpen ? "pointer-events-auto" : "pointer-events-none")}>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={cn("absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity", isOpen ? "opacity-100" : "opacity-0")}
      />
      <aside
        className={cn(
          "absolute inset-y-0 right-0 w-full max-w-md bg-gradient-to-b from-violet-950 to-fuchsia-950 p-6 shadow-2xl transition-transform",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {task && (
          <div className="flex h-full flex-col">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-violet-400/80">Task Details</p>
                <h3 className="mt-1 text-xl font-semibold text-white">{task.name}</h3>
              </div>
              <button onClick={onClose} className="rounded-xl bg-white/10 p-2 text-white/70 hover:bg-white/20 hover:text-white">
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-3">
              {[
                { label: "Type", value: <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white bg-gradient-to-r", tone?.gradient)}>{task.type}</span> },
                { label: "Schedule", value: task.schedule },
                { label: "Enabled", value: task.enabled ? "Yes" : "No" },
                { label: "Last Run", value: formatDateTime(task.lastRun) },
                { label: "Next Fire", value: formatDateTime(task.nextFire) },
              ].map((row) => (
                <div key={row.label} className="rounded-2xl bg-white/5 p-4">
                  <p className="text-xs font-medium text-violet-400/80">{row.label}</p>
                  <div className="mt-1 text-sm text-white">{row.value}</div>
                </div>
              ))}

              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-xs font-medium text-violet-400/80">Config</p>
                <pre className="mt-2 max-h-48 overflow-auto rounded-xl bg-black/30 p-3 text-xs text-violet-300/80">
                  {formatConfig(task.config)}
                </pre>
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
    <section className="space-y-4">
      <div className="rounded-3xl bg-gradient-to-br from-violet-950/50 to-fuchsia-950/30 p-5">
        <div className="h-4 w-24 animate-pulse rounded-full bg-white/10" />
        <div className="mt-3 h-8 w-48 animate-pulse rounded-full bg-white/10" />
      </div>
      <div className="rounded-3xl bg-gradient-to-br from-violet-950/50 to-fuchsia-950/30 p-4">
        <div className="h-64 animate-pulse rounded-2xl bg-white/5" />
      </div>
      <div className="flex items-center justify-center gap-2 rounded-2xl bg-white/5 p-4">
        <Loader2 className="size-4 animate-spin text-violet-400" />
        <span className="text-sm text-violet-300/70">Loading...</span>
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
  if (!ts) return "Not recorded";
  return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatConfig(config: unknown) {
  if (!config) return "No config";
  try { return JSON.stringify(config, null, 2); } catch { return String(config); }
}

function formatHour(hour: number) {
  if (hour === 0) return "12a";
  if (hour < 12) return `${hour}a`;
  if (hour === 12) return "12p";
  return `${hour - 12}p`;
}

function minuteToOffset(minutes: number) {
  return (minutes / 60) * SLOT_HEIGHT;
}

function minutesToHeight(minutes: number) {
  return Math.max((minutes / 60) * SLOT_HEIGHT, 28);
}

function getMobileOffsetForDate(date: Date) {
  const index = (date.getDay() + 6) % 7;
  return index <= 2 ? 0 : index <= 5 ? 3 : 4;
}
