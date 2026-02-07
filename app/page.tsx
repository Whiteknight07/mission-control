"use client";

import { ActivityFeed, DashboardStats, SearchBar, UpcomingTasksWidget } from "@/components/designs/glass-morphism";

export default function Home() {
  return (
    <div className="space-y-6 pb-4">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm md:p-8">
        <p className="text-xs font-medium uppercase tracking-widest text-white/60">Clawd Dashboard</p>
        <h1 className="mt-3 max-w-2xl text-3xl font-light text-white md:text-5xl">
          Mission Control
        </h1>
        <p className="mt-4 max-w-3xl text-sm text-white/50 md:text-base">
          Real-time telemetry hub for agent activity, scheduler visibility, and indexed workspace intelligence.
        </p>
      </section>

      <DashboardStats />

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-white/80">Search Console</h2>
        <SearchBar widget />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
        <div className="space-y-3">
          <h2 className="text-lg font-medium text-white/80">Recent Activity</h2>
          <ActivityFeed limit={5} compact showFilters={false} />
        </div>
        <UpcomingTasksWidget />
      </section>
    </div>
  );
}
