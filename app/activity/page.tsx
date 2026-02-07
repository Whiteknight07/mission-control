import { ActivityFeed } from "@/components/activity-feed";

export default function ActivityPage() {
  return (
    <div className="space-y-4 pb-4">
      <header className="panel-frame rounded-2xl p-6">
        <p className="font-display text-xs uppercase tracking-[0.22em] text-primary/80">Realtime Stream</p>
        <h1 className="mt-2 font-display text-3xl uppercase tracking-[0.14em]">Activity Feed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Chronological telemetry of every agent action. Updates are pushed live through Convex subscriptions.
        </p>
      </header>
      <ActivityFeed />
    </div>
  );
}
