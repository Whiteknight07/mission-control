import { ActivityFeed } from "@/components/activity-feed";
import { DashboardStats } from "@/components/dashboard-stats";

export default function Home() {
  return (
    <div className="space-y-6 pb-4">
      <section className="panel-frame rounded-2xl p-6 md:p-8">
        <p className="font-display text-xs uppercase tracking-[0.26em] text-primary/90">Clawd Dashboard</p>
        <h1 className="mt-3 max-w-2xl font-display text-3xl uppercase tracking-[0.12em] text-foreground md:text-5xl">
          Mission Control
        </h1>
        <p className="mt-4 max-w-3xl text-sm text-muted-foreground md:text-base">
          Dragon-grade telemetry hub for agent activity, scheduler visibility, and indexed workspace intelligence. Built for realtime monitoring with Convex subscriptions.
        </p>
      </section>

      <DashboardStats />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg uppercase tracking-[0.16em] text-primary">Recent Activity Snapshot</h2>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Latest 5 Events</p>
        </div>
        <ActivityFeed limit={5} compact showFilters={false} />
      </section>
    </div>
  );
}
