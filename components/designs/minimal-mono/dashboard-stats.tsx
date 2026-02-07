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
    <section className="grid gap-px border border-neutral-800 bg-neutral-800 lg:grid-cols-3">
      <StatCard
        href="/activity"
        label="Activity"
        value={activities?.length}
        subtitle="Events"
      />
      <StatCard
        href="/calendar"
        label="Scheduled"
        value={tasks?.length}
        subtitle="Tasks"
      />
      <StatCard
        href="/search"
        label="Indexed"
        value={documents?.length}
        subtitle="Documents"
      />
    </section>
  );
}

type StatCardProps = {
  href: string;
  label: string;
  value?: number;
  subtitle: string;
};

function StatCard({ href, label, value, subtitle }: StatCardProps) {
  return (
    <Link href={href} className="group bg-neutral-950 p-6 transition-colors hover:bg-neutral-900">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-3 text-4xl font-light tabular-nums text-white">{value ?? "—"}</p>
      <p className="mt-1 text-xs text-neutral-600">{subtitle}</p>
    </Link>
  );
}
