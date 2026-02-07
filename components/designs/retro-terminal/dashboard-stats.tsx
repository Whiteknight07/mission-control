"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";

export function DashboardStats() {
  const [fromMs] = useState(() => Date.now());

  const activities = useQuery(api.activities.list, { limit: 200 });
  const tasks = useQuery(api.scheduledTasks.listUpcoming, { enabledOnly: true, limit: 200, fromMs });
  const documents = useQuery(api.documents.list, { limit: 200 });

  return (
    <section className="grid gap-3 font-mono text-[#33ff33] lg:grid-cols-3">
      <StatCard
        href="/activity"
        cmd="$ tail -f /var/log/activity"
        label="activity"
        value={activities?.length}
      />
      <StatCard
        href="/calendar"
        cmd="$ crontab -l | wc -l"
        label="scheduled"
        value={tasks?.length}
      />
      <StatCard
        href="/search"
        cmd="$ find . -type f | wc -l"
        label="indexed"
        value={documents?.length}
      />
    </section>
  );
}

type StatCardProps = {
  href: string;
  cmd: string;
  label: string;
  value?: number;
};

function StatCard({ href, cmd, label, value }: StatCardProps) {
  return (
    <article className="relative overflow-hidden rounded border border-[#33ff33]/30 bg-black p-4 transition-all hover:border-[#33ff33]/60 hover:bg-[#33ff33]/5">
      <p className="text-[10px] text-[#33ff33]/50">{cmd}</p>

      <div className="mt-3 flex items-baseline gap-2">
        <p className="text-4xl font-bold tabular-nums">{value ?? "--"}</p>
        <p className="text-xs text-[#33ff33]/50">{label}</p>
      </div>

      <Link
        href={href}
        className="mt-4 flex w-full items-center justify-center rounded border border-[#33ff33]/30 py-2 text-xs transition-all hover:border-[#33ff33] hover:bg-[#33ff33]/10"
      >
        $ cd {href} <span className="ml-1 animate-pulse">_</span>
      </Link>

      {/* Scanline */}
      <div className="pointer-events-none absolute inset-0 rounded bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.05)_50%)] bg-[length:100%_4px]" />
    </article>
  );
}
