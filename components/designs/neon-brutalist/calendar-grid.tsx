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
const SLOT_HEIGHT = 52;
const DAY_HEIGHT = HOURS.length * SLOT_HEIGHT;

const typeTone: Record<string, { bg: string; border: string }> = {
  cron: { bg: "#00ff00", border: "#00ff00" },
  reminder: { bg: "#ffff00", border: "#ffff00" },
  recurring: { bg: "#00ffff", border: "#00ffff" },
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
      const key = dayKey(day);
      map.get(key)!.sort((a, b) => (a.nextFire ?? 0) - (b.nextFire ?? 0));
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
    return `${s} - ${e}`.toUpperCase();
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
    const today = new Date();
    setNavDirection("idle");
    setWeekStart(startOfWeek(today));
    setMobileOffset(getMobileOffsetForDate(today));
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
      <div className="border-4 border-[#00ffff] bg-black p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#00ffff]">MISSION_PLANNER</p>
            <h2 className="mt-1 text-2xl font-black uppercase tracking-wider text-white">{weekLabel}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "PREV", onClick: handlePrevWeek, icon: ChevronLeft },
              { label: "TODAY", onClick: handleToday, icon: null },
              { label: "NEXT", onClick: handleNextWeek, icon: ChevronRight },
            ].map((btn) => (
              <button
                key={btn.label}
                onClick={btn.onClick}
                className="flex items-center gap-1 border-2 border-[#00ffff] px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[#00ffff] transition-colors hover:bg-[#00ffff] hover:text-black"
              >
                {btn.icon === ChevronLeft && <ChevronLeft className="size-3" strokeWidth={3} />}
                {btn.label}
                {btn.icon === ChevronRight && <ChevronRight className="size-3" strokeWidth={3} />}
              </button>
            ))}
            <button
              onClick={handleSeed}
              disabled={seedState === "pending"}
              className="flex items-center gap-1 bg-[#ff00ff] px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-black transition-opacity disabled:opacity-50"
            >
              {seedState === "pending" ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <DatabaseZap className="size-3" strokeWidth={3} />
              )}
              SEED_TASKS
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px]">
          {Object.entries(typeTone).map(([type, { bg }]) => (
            <span key={type} className="flex items-center gap-1">
              <span className="size-3" style={{ backgroundColor: bg }} />
              <span className="font-black uppercase text-white/70">{type}</span>
            </span>
          ))}
          <span className="flex items-center gap-1 text-white/50">
            <Timer className="size-3" />
            {isCurrentWeek ? "CURRENT WEEK" : "VIEWING OTHER WEEK"}
          </span>
        </div>
      </div>

      {/* Mobile 3-day view */}
      <div className="border-4 border-[#ff00ff] bg-black p-3 md:hidden">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#ff00ff]">3_DAY_VIEW</span>
          <div className="flex gap-1">
            <button
              onClick={() => setMobileOffset((v) => Math.max(0, v - 1))}
              disabled={mobileOffset === 0}
              className="border-2 border-[#ff00ff] p-1 text-[#ff00ff] disabled:opacity-30"
            >
              <ChevronLeft className="size-3" />
            </button>
            <button
              onClick={() => setMobileOffset((v) => Math.min(4, v + 1))}
              disabled={mobileOffset >= 4}
              className="border-2 border-[#ff00ff] p-1 text-[#ff00ff] disabled:opacity-30"
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

      {/* Desktop 7-day view */}
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

type PlannerBoardProps = {
  days: Date[];
  groupedTasks: Map<string, ScheduledTask[]>;
  nowMs: number;
  onSelectTask: (task: ScheduledTask) => void;
  selectedTaskId?: ScheduledTask["_id"];
};

function PlannerBoard({ days, groupedTasks, nowMs, onSelectTask, selectedTaskId }: PlannerBoardProps) {
  const now = new Date(nowMs);

  return (
    <div className="overflow-hidden border-4 border-[#00ffff]">
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          {/* Header */}
          <div
            className="grid border-b-2 border-[#00ffff]"
            style={{ gridTemplateColumns: `60px repeat(${days.length}, minmax(140px, 1fr))` }}
          >
            <div className="border-r-2 border-[#00ffff] bg-black p-2 text-right text-[9px] font-black uppercase text-white/50">
              UTC
            </div>
            {days.map((day) => {
              const isToday = dayKey(day) === dayKey(now);
              return (
                <div
                  key={dayKey(day)}
                  className={cn("border-r-2 border-[#00ffff] p-2", isToday && "bg-[#00ffff]/10")}
                >
                  <p className="text-xs font-black uppercase text-[#00ffff]">
                    {day.toLocaleDateString("en-US", { weekday: "short" })}
                  </p>
                  <p className="text-[10px] text-white/60">
                    {day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Grid */}
          <div
            className="grid bg-black"
            style={{ gridTemplateColumns: `60px repeat(${days.length}, minmax(140px, 1fr))` }}
          >
            {/* Hours column */}
            <div className="relative border-r-2 border-[#00ffff]" style={{ height: `${DAY_HEIGHT}px` }}>
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="absolute left-0 right-0 border-t border-white/10 text-right text-[9px] font-bold text-white/40"
                  style={{ top: `${hour * SLOT_HEIGHT}px` }}
                >
                  <span className="mr-1">{formatHour(hour)}</span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((day) => {
              const key = dayKey(day);
              const dayTasks = groupedTasks.get(key) ?? [];
              const isToday = key === dayKey(now);
              const nowTop = isToday ? minuteToOffset(now.getHours() * 60 + now.getMinutes()) : null;

              return (
                <div
                  key={key}
                  className={cn("relative border-r-2 border-[#00ffff]", isToday && "bg-[#00ffff]/5")}
                  style={{ height: `${DAY_HEIGHT}px` }}
                >
                  {/* Hour lines */}
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="absolute left-0 right-0 border-t border-white/10"
                      style={{ top: `${hour * SLOT_HEIGHT}px` }}
                    />
                  ))}

                  {/* Tasks */}
                  {dayTasks.map((task) => {
                    if (!task.nextFire) return null;
                    const startDate = new Date(task.nextFire);
                    const minutes = startDate.getHours() * 60 + startDate.getMinutes();
                    const top = minuteToOffset(minutes);
                    const height = minutesToHeight(getTaskDuration(task));
                    const tone = typeTone[task.type] ?? { bg: "#ffffff", border: "#ffffff" };

                    return (
                      <button
                        key={task._id}
                        type="button"
                        onClick={() => onSelectTask(task)}
                        className={cn(
                          "absolute left-1 right-1 border-l-4 px-2 py-1 text-left transition-all hover:brightness-110",
                          !task.enabled && "opacity-40",
                          selectedTaskId === task._id && "ring-2 ring-white"
                        )}
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          backgroundColor: `${tone.bg}20`,
                          borderLeftColor: tone.bg,
                        }}
                      >
                        <p className="truncate text-[9px] font-black uppercase text-white">{task.name}</p>
                        <p className="text-[10px] text-white/70">
                          {startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </button>
                    );
                  })}

                  {/* Now line */}
                  {nowTop !== null && (
                    <div
                      className="pointer-events-none absolute left-0 right-0 z-10"
                      style={{ top: `${nowTop}px` }}
                    >
                      <div className="absolute -left-1 top-0 size-3 bg-[#ff00ff]" />
                      <div className="h-[2px] bg-[#ff00ff] shadow-[0_0_10px_#ff00ff]" />
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
        className={cn(
          "absolute inset-0 bg-black/80 transition-opacity",
          isOpen ? "opacity-100" : "opacity-0"
        )}
      />
      <aside
        className={cn(
          "absolute inset-y-0 right-0 w-full max-w-md border-l-4 bg-black p-5 transition-transform",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
        style={{ borderLeftColor: tone?.border ?? "#ff00ff" }}
      >
        {task && (
          <div className="flex h-full flex-col">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#ff00ff]">TASK_DETAIL</p>
                <h3 className="mt-1 text-xl font-black uppercase text-white">{task.name}</h3>
              </div>
              <button onClick={onClose} className="p-1 text-white/70 hover:text-white">
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-3">
              {[
                { label: "TYPE", value: task.type.toUpperCase() },
                { label: "SCHEDULE", value: task.schedule },
                { label: "ENABLED", value: task.enabled ? "YES" : "NO" },
                { label: "LAST_RUN", value: formatDateTime(task.lastRun) },
                { label: "NEXT_FIRE", value: formatDateTime(task.nextFire) },
              ].map((row) => (
                <div key={row.label} className="border-l-2 border-[#ff00ff]/50 bg-white/5 p-3">
                  <p className="text-[9px] font-black uppercase text-[#ff00ff]/70">{row.label}</p>
                  <p className="mt-1 text-sm text-white">{row.value}</p>
                </div>
              ))}

              <div className="border-l-2 border-[#ff00ff]/50 bg-white/5 p-3">
                <p className="text-[9px] font-black uppercase text-[#ff00ff]/70">CONFIG</p>
                <pre className="mt-2 overflow-auto text-[10px] text-white/70">
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
      <div className="border-4 border-[#00ffff]/50 bg-black p-4">
        <div className="h-4 w-32 animate-pulse bg-[#00ffff]/30" />
        <div className="mt-3 h-8 w-64 animate-pulse bg-white/10" />
      </div>
      <div className="border-4 border-[#00ffff]/50 bg-black p-4">
        <div className="h-64 animate-pulse bg-white/5" />
      </div>
      <div className="flex items-center justify-center gap-2 border-4 border-[#00ffff]/30 p-4">
        <Loader2 className="size-4 animate-spin text-[#00ffff]" />
        <span className="text-xs font-black uppercase tracking-widest text-[#00ffff]">SYNCING...</span>
      </div>
    </section>
  );
}

// Utility functions
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
  const day = start.getDay();
  start.setDate(start.getDate() - ((day + 6) % 7));
  return start;
}

function getTaskDuration(task: ScheduledTask) {
  const config = typeof task.config === "object" && task.config !== null ? task.config : null;
  const configured = config && "durationMinutes" in config ? (config as Record<string, unknown>).durationMinutes : null;
  if (typeof configured === "number" && Number.isFinite(configured)) return Math.min(Math.max(configured, 15), 180);
  if (task.type === "recurring") return 60;
  if (task.type === "cron") return 40;
  return 30;
}

function formatDateTime(timestamp?: number) {
  if (!timestamp) return "NOT_RECORDED";
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatConfig(config: unknown) {
  if (config === undefined) return "NO_CONFIG";
  try {
    return JSON.stringify(config, null, 2);
  } catch {
    return String(config);
  }
}

function formatHour(hour: number) {
  if (hour === 0) return "12A";
  if (hour < 12) return `${hour}A`;
  if (hour === 12) return "12P";
  return `${hour - 12}P`;
}

function minuteToOffset(minutes: number) {
  return (minutes / 60) * SLOT_HEIGHT;
}

function minutesToHeight(minutes: number) {
  return Math.max((minutes / 60) * SLOT_HEIGHT, 24);
}

function getMobileOffsetForDate(date: Date) {
  const index = Math.max(0, Math.min(6, (date.getDay() + 6) % 7));
  if (index <= 2) return 0;
  if (index <= 5) return 3;
  return 4;
}
