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
        icon={<Activity className="size-6" />}
        label="LIVE_ACTIVITY"
        value={activities?.length}
        color="#ff00ff"
      />
      <StatCard
        href="/calendar"
        icon={<CalendarClock className="size-6" />}
        label="SCHEDULED"
        value={tasks?.length}
        color="#00ffff"
      />
      <StatCard
        href="/search"
        icon={<FileSearch className="size-6" />}
        label="INDEXED_DOCS"
        value={documents?.length}
        color="#ffff00"
      />
    </section>
  );
}

type StatCardProps = {
  href: string;
  icon: React.ReactNode;
  label: string;
  value?: number;
  color: string;
};

function StatCard({ href, icon, label, value, color }: StatCardProps) {
  return (
    <article className="group relative border-4 bg-black p-5 transition-all hover:translate-x-1" style={{ borderColor: color }}>
      {/* Corner accent */}
      <div className="absolute right-0 top-0 size-8" style={{ backgroundColor: color }} />

      <div className="flex items-center justify-between">
        <span
          className="px-2 py-0.5 text-[10px] font-black text-black"
          style={{ backgroundColor: color }}
        >
          {label}
        </span>
        <div style={{ color }}>{icon}</div>
      </div>

      <div className="mt-6 flex items-baseline gap-2">
        <p className="text-5xl font-black tabular-nums text-white">{value ?? "--"}</p>
        <p className="text-[10px] font-black uppercase tracking-widest text-white/50">RECORDS</p>
      </div>

      <Link
        href={href}
        className="mt-4 flex items-center justify-center border-2 py-2 text-[10px] font-black uppercase tracking-widest transition-colors hover:text-black"
        style={{
          borderColor: color,
          color: color,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = color)}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
      >
        OPEN
      </Link>
    </article>
  );
}
