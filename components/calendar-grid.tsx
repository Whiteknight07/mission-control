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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ScheduledTask = Doc<"scheduledTasks">;

type NavDirection = "idle" | "forward" | "back";

type SeedState = "idle" | "pending" | "created" | "skipped" | "error";

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const SLOT_HEIGHT = 58;
const DAY_HEIGHT = HOURS.length * SLOT_HEIGHT;

const typeTone: Record<
  string,
  {
    block: string;
    badge: string;
    glow: string;
  }
> = {
  cron: {
    block: "border-emerald-400/60 bg-emerald-500/18 text-emerald-200",
    badge: "border-emerald-400/50 bg-emerald-950/60 text-emerald-300",
    glow: "shadow-[0_0_28px_-10px_rgba(74,222,128,0.9)]",
  },
  reminder: {
    block: "border-amber-400/60 bg-amber-500/18 text-amber-100",
    badge: "border-amber-400/50 bg-amber-950/60 text-amber-300",
    glow: "shadow-[0_0_28px_-10px_rgba(251,191,36,0.9)]",
  },
  recurring: {
    block: "border-sky-400/60 bg-sky-500/18 text-sky-100",
    badge: "border-sky-400/50 bg-sky-950/60 text-sky-300",
    glow: "shadow-[0_0_28px_-10px_rgba(56,189,248,0.9)]",
  },
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
    [weekStart],
  );

  const groupedTasks = useMemo(() => {
    const map = new Map<string, ScheduledTask[]>();

    for (const day of weekDays) {
      map.set(dayKey(day), []);
    }

    for (const task of tasks ?? []) {
      if (!task.nextFire) {
        continue;
      }

      const key = dayKey(new Date(task.nextFire));
      if (!map.has(key)) {
        continue;
      }

      const existing = map.get(key) ?? [];
      existing.push(task);
      map.set(key, existing);
    }

    for (const day of weekDays) {
      const key = dayKey(day);
      const list = map.get(key) ?? [];
      list.sort((a, b) => (a.nextFire ?? 0) - (b.nextFire ?? 0));
      map.set(key, list);
    }

    return map;
  }, [tasks, weekDays]);

  const selectedTask = useMemo(() => {
    if (!selectedTaskId || !tasks) {
      return null;
    }

    return tasks.find((task) => task._id === selectedTaskId) ?? null;
  }, [selectedTaskId, tasks]);

  const isCurrentWeek = useMemo(() => dayKey(startOfWeek(new Date())) === dayKey(weekStart), [weekStart]);

  const weekLabel = useMemo(() => {
    const startLabel = weekStart.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const endLabel = addDays(weekStart, 6).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    return `${startLabel} - ${endLabel}`;
  }, [weekStart]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 30_000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedTaskId(null);
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  const desktopAnimation = useMemo(() => {
    if (navDirection === "forward") {
      return "animate-in slide-in-from-right-3 fade-in-0 duration-300";
    }
    if (navDirection === "back") {
      return "animate-in slide-in-from-left-3 fade-in-0 duration-300";
    }
    return "animate-in fade-in-0 duration-300";
  }, [navDirection]);

  const mobileDays = weekDays.slice(mobileOffset, mobileOffset + 3);

  const handlePrevWeek = () => {
    setNavDirection("back");
    setWeekStart((current) => addDays(current, -7));
    setMobileOffset(0);
  };

  const handleNextWeek = () => {
    setNavDirection("forward");
    setWeekStart((current) => addDays(current, 7));
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

  if (!tasks) {
    return <CalendarSkeleton />;
  }

  return (
    <section className="space-y-4">
      <div className="panel-frame rounded-2xl p-4 md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-display text-xs uppercase tracking-[0.18em] text-primary/80">Mission Planning Window</p>
            <h2 className="mt-1 font-display text-2xl uppercase tracking-[0.14em]">{weekLabel}</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={handlePrevWeek} className="font-display uppercase tracking-[0.14em]">
              <ChevronLeft className="size-4" />
              Prev
            </Button>
            <Button size="sm" variant="outline" onClick={handleToday} className="font-display uppercase tracking-[0.14em]">
              Today
            </Button>
            <Button size="sm" variant="outline" onClick={handleNextWeek} className="font-display uppercase tracking-[0.14em]">
              Next
              <ChevronRight className="size-4" />
            </Button>
            <Button
              size="sm"
              onClick={handleSeed}
              disabled={seedState === "pending"}
              className="font-display uppercase tracking-[0.14em]"
            >
              {seedState === "pending" ? <Loader2 className="size-4 animate-spin" /> : <DatabaseZap className="size-4" />}
              Seed Demo Tasks
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="rounded-md border-emerald-400/50 bg-emerald-950/50 text-emerald-300">
            cron
          </Badge>
          <Badge variant="outline" className="rounded-md border-amber-400/50 bg-amber-950/50 text-amber-300">
            reminder
          </Badge>
          <Badge variant="outline" className="rounded-md border-sky-400/50 bg-sky-950/50 text-sky-300">
            recurring
          </Badge>
          <span className="inline-flex items-center gap-1">
            <Timer className="size-3.5 text-primary" />
            {isCurrentWeek ? "Realtime clock synced to current week" : "Viewing historical/future week window"}
          </span>
          {seedState === "created" && <span className="text-primary">Demo tasks seeded.</span>}
          {seedState === "skipped" && <span>Tasks already exist. Use force mode in Convex if needed.</span>}
          {seedState === "error" && <span className="text-destructive">Seeding failed. Check Convex logs.</span>}
        </div>
      </div>

      <div className="panel-frame rounded-2xl p-3 md:hidden">
        <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-display uppercase tracking-[0.14em]">Mobile 3-Day Window</span>
          <div className="flex items-center gap-1">
            <Button
              size="icon-xs"
              variant="outline"
              onClick={() => setMobileOffset((value) => Math.max(0, value - 1))}
              disabled={mobileOffset === 0}
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              size="icon-xs"
              variant="outline"
              onClick={() => setMobileOffset((value) => Math.min(4, value + 1))}
              disabled={mobileOffset >= 4}
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>

        <PlannerBoard
          key={`mobile-${weekStart.getTime()}-${mobileOffset}`}
          days={mobileDays}
          groupedTasks={groupedTasks}
          nowMs={nowMs}
          animationClass={desktopAnimation}
          onSelectTask={(task) => setSelectedTaskId(task._id)}
          selectedTaskId={selectedTaskId ?? undefined}
        />
      </div>

      <div className="hidden md:block">
        <PlannerBoard
          key={`desktop-${weekStart.getTime()}`}
          days={weekDays}
          groupedTasks={groupedTasks}
          nowMs={nowMs}
          animationClass={desktopAnimation}
          onSelectTask={(task) => setSelectedTaskId(task._id)}
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
  animationClass: string;
  onSelectTask: (task: ScheduledTask) => void;
  selectedTaskId?: ScheduledTask["_id"];
};

function PlannerBoard({ days, groupedTasks, nowMs, animationClass, onSelectTask, selectedTaskId }: PlannerBoardProps) {
  const now = new Date(nowMs);

  return (
    <div className={cn("panel-frame overflow-hidden rounded-2xl", animationClass)}>
      <div className="overflow-x-auto">
        <div
          className="min-w-[720px]"
          style={{
            gridTemplateColumns: `74px repeat(${days.length}, minmax(170px, 1fr))`,
          }}
        >
          <div className="grid border-b border-border/70" style={{ gridTemplateColumns: `74px repeat(${days.length}, minmax(170px, 1fr))` }}>
            <div className="border-r border-border/70 p-2 text-right text-[10px] uppercase tracking-[0.14em] text-muted-foreground">UTC Local</div>
            {days.map((day) => {
              const isToday = dayKey(day) === dayKey(now);

              return (
                <div
                  key={dayKey(day)}
                  className={cn(
                    "border-r border-border/70 p-2",
                    isToday && "bg-primary/10 shadow-[inset_0_0_0_1px_rgba(140,245,147,0.25)]",
                  )}
                >
                  <p className="font-display text-xs uppercase tracking-[0.18em] text-primary/90">
                    {day.toLocaleDateString("en-US", { weekday: "short" })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {day.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="grid" style={{ gridTemplateColumns: `74px repeat(${days.length}, minmax(170px, 1fr))` }}>
            <div className="relative border-r border-border/70" style={{ height: `${DAY_HEIGHT}px` }}>
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="absolute left-0 right-1 border-t border-border/60 text-right text-[10px] text-muted-foreground"
                  style={{ top: `${hour * SLOT_HEIGHT}px` }}
                >
                  <span className="-translate-y-1/2 bg-background/70 px-1 py-px inline-block">
                    {formatHour(hour)}
                  </span>
                </div>
              ))}
            </div>

            {days.map((day) => {
              const key = dayKey(day);
              const tasks = groupedTasks.get(key) ?? [];
              const isToday = key === dayKey(now);
              const nowTop = isToday ? minuteToOffset(now.getHours() * 60 + now.getMinutes()) : null;

              return (
                <div
                  key={key}
                  className={cn(
                    "relative border-r border-border/70",
                    isToday && "bg-primary/10",
                  )}
                  style={{
                    height: `${DAY_HEIGHT}px`,
                    backgroundImage:
                      "repeating-linear-gradient(to bottom, rgba(140,245,147,0.16) 0 1px, transparent 1px 58px), repeating-linear-gradient(45deg, rgba(140,245,147,0.06) 0 1px, transparent 1px 12px)",
                  }}
                >
                  {tasks.length === 0 && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70">
                      quiet window
                    </div>
                  )}

                  {tasks.map((task) => {
                    if (!task.nextFire) {
                      return null;
                    }

                    const startDate = new Date(task.nextFire);
                    const minutes = startDate.getHours() * 60 + startDate.getMinutes();
                    const top = minuteToOffset(minutes);
                    const height = minutesToHeight(getTaskDuration(task));
                    const tone = typeTone[task.type] ?? {
                      block: "border-border/80 bg-muted/40 text-foreground",
                      badge: "border-border/80 bg-muted/70 text-foreground",
                      glow: "",
                    };

                    return (
                      <button
                        key={task._id}
                        type="button"
                        onClick={() => onSelectTask(task)}
                        className={cn(
                          "absolute left-1.5 right-1.5 rounded-lg border px-2 py-1 text-left transition-all duration-200 hover:scale-[1.01] hover:brightness-110",
                          tone.block,
                          tone.glow,
                          !task.enabled && "opacity-55 saturate-0",
                          selectedTaskId === task._id && "ring-1 ring-primary/80",
                        )}
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                        }}
                      >
                        <p className="line-clamp-1 font-display text-[10px] uppercase tracking-[0.15em]">{task.name}</p>
                        <p className="mt-0.5 text-[11px] opacity-90">
                          {startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                        <Badge variant="outline" className={cn("mt-1 rounded-sm px-1 py-0 text-[9px] uppercase", tone.badge)}>
                          {task.type}
                        </Badge>
                      </button>
                    );
                  })}

                  {nowTop !== null && (
                    <div className="pointer-events-none absolute left-0 right-0 z-20 transition-all duration-500" style={{ top: `${nowTop}px` }}>
                      <div className="absolute -left-1 top-0 size-2 rounded-full bg-primary shadow-[0_0_12px_var(--color-primary)]" />
                      <div className="h-px bg-primary shadow-[0_0_20px_0_var(--color-primary)]" />
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

type TaskDetailPanelProps = {
  task: ScheduledTask | null;
  onClose: () => void;
};

function TaskDetailPanel({ task, onClose }: TaskDetailPanelProps) {
  const isOpen = Boolean(task);
  const tone = task ? typeTone[task.type] : undefined;

  return (
    <div className={cn("fixed inset-0 z-50 transition", isOpen ? "pointer-events-auto" : "pointer-events-none")}>
      <button
        type="button"
        aria-label="Close task details"
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-background/40 backdrop-blur-[2px] transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0",
        )}
      />

      <aside
        className={cn(
          "absolute inset-y-0 right-0 w-full max-w-md border-l border-border/80 bg-card/95 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.6)] backdrop-blur-xl transition-transform duration-300",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        {task && (
          <div className="flex h-full flex-col">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="font-display text-xs uppercase tracking-[0.18em] text-primary/90">Task Detail</p>
                <h3 className="mt-1 font-display text-xl uppercase tracking-[0.12em]">{task.name}</h3>
              </div>
              <Button size="icon-sm" variant="ghost" onClick={onClose}>
                <X className="size-4" />
              </Button>
            </div>

            <div className="space-y-3">
              <div className="panel-frame rounded-xl p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Type</p>
                <Badge variant="outline" className={cn("mt-2 rounded-md uppercase", tone?.badge)}>
                  {task.type}
                </Badge>
              </div>

              <div className="panel-frame rounded-xl p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Schedule</p>
                <p className="mt-1 font-mono text-sm text-foreground">{task.schedule}</p>
              </div>

              <div className="panel-frame rounded-xl p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Enabled</p>
                <p className={cn("mt-1 text-sm", task.enabled ? "text-emerald-300" : "text-muted-foreground")}>{task.enabled ? "Yes" : "No"}</p>
              </div>

              <div className="panel-frame rounded-xl p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Last Run</p>
                <p className="mt-1 flex items-center gap-1 text-sm text-foreground">
                  <Clock3 className="size-3.5 text-primary" />
                  {formatDateTime(task.lastRun)}
                </p>
              </div>

              <div className="panel-frame rounded-xl p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Next Fire</p>
                <p className="mt-1 flex items-center gap-1 text-sm text-foreground">
                  <CalendarClock className="size-3.5 text-primary" />
                  {formatDateTime(task.nextFire)}
                </p>
              </div>

              <div className="panel-frame min-h-0 flex-1 overflow-hidden rounded-xl p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Config</p>
                <pre className="mt-2 max-h-[240px] overflow-auto rounded-md border border-border/80 bg-background/70 p-2 text-xs text-muted-foreground">
                  {formatConfig(task.config)}
                </pre>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs text-primary/90">
              <p className="inline-flex items-center gap-1">
                <DatabaseZap className="size-3.5" />
                Live via Convex subscription: updates appear instantly without refresh.
              </p>
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
      <div className="panel-frame rounded-2xl p-5">
        <div className="h-4 w-48 animate-pulse rounded bg-primary/20" />
        <div className="mt-3 h-8 w-72 animate-pulse rounded bg-muted/60" />
        <div className="mt-3 flex gap-2">
          <div className="h-8 w-20 animate-pulse rounded bg-muted/60" />
          <div className="h-8 w-20 animate-pulse rounded bg-muted/60" />
          <div className="h-8 w-20 animate-pulse rounded bg-muted/60" />
          <div className="h-8 w-36 animate-pulse rounded bg-primary/20" />
        </div>
      </div>

      <div className="panel-frame overflow-hidden rounded-2xl p-3">
        <div className="grid grid-cols-[74px_repeat(7,minmax(0,1fr))] gap-px">
          <div className="h-14 animate-pulse rounded bg-muted/50" />
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded bg-muted/50" />
          ))}
        </div>
        <div className="mt-2 h-72 animate-pulse rounded-xl bg-muted/35" />
      </div>

      <div className="panel-frame flex items-center justify-center rounded-2xl p-5 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin text-primary" />
        Syncing scheduler timeline...
      </div>
    </section>
  );
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function addDays(baseDate: Date, days: number) {
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function startOfWeek(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const delta = (day + 6) % 7;
  start.setDate(start.getDate() - delta);
  return start;
}

function getTaskDuration(task: ScheduledTask) {
  const config = toRecord(task.config);
  const configured = config?.durationMinutes;

  if (typeof configured === "number" && Number.isFinite(configured)) {
    return clamp(configured, 15, 180);
  }

  if (task.type === "recurring") {
    return 60;
  }

  if (task.type === "cron") {
    return 40;
  }

  return 30;
}

function formatDateTime(timestamp?: number) {
  if (!timestamp) {
    return "Not recorded";
  }

  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatConfig(config: unknown) {
  if (config === undefined) {
    return "No config payload";
  }

  try {
    return JSON.stringify(config, null, 2);
  } catch {
    return String(config);
  }
}

function toRecord(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function formatHour(hour: number) {
  if (hour === 0) {
    return "12A";
  }

  if (hour < 12) {
    return `${hour}A`;
  }

  if (hour === 12) {
    return "12P";
  }

  return `${hour - 12}P`;
}

function minuteToOffset(minutes: number) {
  return (minutes / 60) * SLOT_HEIGHT;
}

function minutesToHeight(minutes: number) {
  return Math.max((minutes / 60) * SLOT_HEIGHT, 28);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getMobileOffsetForDate(date: Date) {
  const index = Math.max(0, Math.min(6, (date.getDay() + 6) % 7));

  if (index <= 2) {
    return 0;
  }

  if (index <= 5) {
    return 3;
  }

  return 4;
}
