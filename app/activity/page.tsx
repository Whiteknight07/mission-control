"use client";

import { ActivityFeed } from "@/components/design-components";

export default function ActivityPage() {
  return (
    <div className="space-y-4 pb-4">
      <ActivityFeed showFilters />
    </div>
  );
}
