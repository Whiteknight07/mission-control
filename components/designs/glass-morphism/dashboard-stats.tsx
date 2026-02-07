"use client";

import Link from "next/link";
import { useState } from "react";
import { Activity, CalendarClock, FileSearch } from "lucide-react";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

export function DashboardStats() {
  const [fromMs] = useState(() => Date.now());

  const activities = useQuery(api.activities.list, { limit: 200 });
  const tasks = useQuery(api.scheduledTasks.listUpcoming, { enabledOnly: true, limit: 200, fromMs });
  const documents = useQuery(api.documents.list, { limit: 200 });

  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <StatCard
        href="/activity"
        icon={<Activity className="size-5" />}
        label="Activity"
        value={activities?.length}
        subtitle="Events captured"
        gradient="from-pink-500 to-rose-500"
      />
      <StatCard
        href="/calendar"
        icon={<CalendarClock className="size-5" />}
        label="Scheduled"
        value={tasks?.length}
        subtitle="Upcoming tasks"
        gradient="from-violet-500 to-purple-500"
      />
      <StatCard
        href="/search"
        icon={<FileSearch className="size-5" />}
        label="Indexed"
        value={documents?.length}
        subtitle="Documents"
        gradient="from-cyan-500 to-blue-500"
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
  gradient: string;
};

function StatCard({ href, icon, label, value, subtitle, gradient }: StatCardProps) {
  return (
    <article className="group relative overflow-hidden rounded-3xl border border-white/20 bg-white/10 p-6 shadow-xl backdrop-blur-xl transition-all duration-300 hover:bg-white/15 hover:shadow-2xl">
      {/* Gradient orb */}
      <div className={cn("absolute -right-8 -top-8 size-32 rounded-full bg-gradient-to-br opacity-30 blur-2xl transition-opacity group-hover:opacity-40", gradient)} />

      <div className="relative">
        <div className="flex items-center justify-between">
          <span className={cn("inline-flex rounded-xl bg-gradient-to-r px-3 py-1 text-xs font-medium text-white", gradient)}>
            {label}
          </span>
          <div className={cn("rounded-xl bg-gradient-to-br p-2.5 text-white shadow-lg", gradient)}>
            {icon}
          </div>
        </div>

        <div className="mt-6">
          <p className="text-5xl font-semibold tabular-nums text-white">{value ?? "--"}</p>
          <p className="mt-1 text-sm text-white/50">{subtitle}</p>
        </div>

        <Link
          href={href}
          className="mt-6 flex w-full items-center justify-center rounded-xl bg-white/10 py-3 text-sm font-medium text-white/80 transition-all hover:bg-white/20 hover:text-white"
        >
          View Details
        </Link>
      </div>
    </article>
  );
}
