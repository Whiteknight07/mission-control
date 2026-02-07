import { ActivityFeed } from "@/components/activity-feed";
import { DashboardStats } from "@/components/dashboard-stats";
import { SearchBar } from "@/components/search-bar";
import { UpcomingTasksWidget } from "@/components/upcoming-tasks-widget";

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
        <h2 className="font-display text-lg uppercase tracking-[0.16em] text-primary">Search Console</h2>
        <SearchBar widget />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
        <div className="space-y-3">
          <h2 className="font-display text-lg uppercase tracking-[0.16em] text-primary">Recent Activity Snapshot</h2>
          <ActivityFeed limit={5} compact showFilters={false} />
        </div>
        <UpcomingTasksWidget />
      </section>
    </div>
  );
}
