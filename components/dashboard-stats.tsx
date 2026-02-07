"use client";

import Link from "next/link";
import { Activity, CalendarClock, FileSearch } from "lucide-react";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function DashboardStats() {
  const activities = useQuery(api.activities.list, { limit: 200 });
  const tasks = useQuery(api.scheduledTasks.listUpcoming, { enabledOnly: true, limit: 200 });
  const documents = useQuery(api.documents.list, { limit: 200 });

  const activityCount = activities?.length;
  const taskCount = tasks?.length;
  const documentCount = documents?.length;

  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <StatCard
        href="/activity"
        icon={<Activity className="size-4" />}
        label="Live Activity"
        value={activityCount}
        subtitle="Events captured from Clawd"
      />
      <StatCard
        href="/calendar"
        icon={<CalendarClock className="size-4" />}
        label="Scheduled Tasks"
        value={taskCount}
        subtitle="Upcoming cron/reminder executions"
      />
      <StatCard
        href="/search"
        icon={<FileSearch className="size-4" />}
        label="Indexed Docs"
        value={documentCount}
        subtitle="Searchable memory/config/log files"
      />
    </section>
  );
}

type StatCardProps = {
  href: string;
  icon: React.ReactNode;
  label: string;
  value?: number;
  subtitle: string;
};

function StatCard({ href, icon, label, value, subtitle }: StatCardProps) {
  return (
    <article className="panel-frame rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="rounded-md border-primary/50 bg-primary/10 font-display uppercase tracking-[0.14em] text-primary">
          {label}
        </Badge>
        <div className="rounded-lg border border-border/80 bg-muted/30 p-2 text-primary">{icon}</div>
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <p className="font-display text-4xl uppercase tracking-[0.14em] text-foreground">{value ?? "--"}</p>
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">records</p>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>

      <Button asChild size="sm" className="mt-4 w-full font-display uppercase tracking-[0.14em]">
        <Link href={href}>Open</Link>
      </Button>
    </article>
  );
}
