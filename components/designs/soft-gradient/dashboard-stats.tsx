"use client";

import Link from "next/link";
import { useState } from "react";
import { Activity, CalendarClock, FileSearch } from "lucide-react";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";

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
        label="Live Activity"
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
        subtitle="Searchable docs"
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
    <article className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-950/50 to-fuchsia-950/30 p-6 shadow-xl shadow-violet-500/10 backdrop-blur-sm transition-all duration-300 hover:shadow-violet-500/20">
      {/* Gradient orb background */}
      <div className={`absolute -right-8 -top-8 size-32 rounded-full bg-gradient-to-br ${gradient} opacity-20 blur-2xl transition-all group-hover:opacity-30`} />

      <div className="relative">
        <div className="flex items-center justify-between">
          <span className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r ${gradient} px-3 py-1 text-xs font-medium text-white`}>
            {label}
          </span>
          <div className={`rounded-2xl bg-gradient-to-br ${gradient} p-2.5 text-white shadow-lg`}>
            {icon}
          </div>
        </div>

        <div className="mt-6">
          <p className="text-5xl font-semibold tabular-nums text-white">{value ?? "--"}</p>
          <p className="mt-1 text-sm text-violet-300/70">{subtitle}</p>
        </div>

        <Link
          href={href}
          className="mt-6 flex w-full items-center justify-center rounded-2xl bg-white/5 py-3 text-sm font-medium text-violet-300 transition-all hover:bg-white/10 hover:text-white"
        >
          View Details
        </Link>
      </div>
    </article>
  );
}
