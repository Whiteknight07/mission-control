import { CalendarGrid } from "@/components/calendar-grid";

export default function CalendarPage() {
  return (
    <div className="space-y-4 pb-4">
      <header className="panel-frame rounded-2xl p-6">
        <p className="font-display text-xs uppercase tracking-[0.22em] text-primary/80">Scheduler View</p>
        <h1 className="mt-2 font-display text-3xl uppercase tracking-[0.14em]">Calendar</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Weekly command board for cron/reminder/recurring tasks, including upcoming fire windows.
        </p>
      </header>
      <CalendarGrid />
    </div>
  );
}
