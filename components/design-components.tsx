"use client";

import { useDesign, type DesignVariant } from "./design-provider";

// Import all design variants
import * as NeonBrutalist from "./designs/neon-brutalist";
import * as SoftGradient from "./designs/soft-gradient";
import * as RetroTerminal from "./designs/retro-terminal";
import * as GlassMorphism from "./designs/glass-morphism";
import * as MinimalMono from "./designs/minimal-mono";

type DesignComponents = {
  Nav: React.ComponentType;
  ActivityFeed: React.ComponentType<{ limit?: number; showFilters?: boolean; compact?: boolean }>;
  CalendarGrid: React.ComponentType;
  DashboardStats: React.ComponentType;
  SearchBar: React.ComponentType<{ widget?: boolean; className?: string }>;
  UpcomingTasksWidget: React.ComponentType;
};

const designMap: Record<DesignVariant, DesignComponents> = {
  "neon-brutalist": NeonBrutalist,
  "soft-gradient": SoftGradient,
  "retro-terminal": RetroTerminal,
  "glass-morphism": GlassMorphism,
  "minimal-mono": MinimalMono,
};

// Hook to get all components for the active design
export function useDesignComponents() {
  const { variant } = useDesign();
  return designMap[variant];
}

// Individual component exports that automatically use the active design
export function Nav() {
  const components = useDesignComponents();
  return <components.Nav />;
}

export function ActivityFeed(props: { limit?: number; showFilters?: boolean; compact?: boolean }) {
  const components = useDesignComponents();
  return <components.ActivityFeed {...props} />;
}

export function CalendarGrid() {
  const components = useDesignComponents();
  return <components.CalendarGrid />;
}

export function DashboardStats() {
  const components = useDesignComponents();
  return <components.DashboardStats />;
}

export function SearchBar(props: { widget?: boolean; className?: string }) {
  const components = useDesignComponents();
  return <components.SearchBar {...props} />;
}

export function UpcomingTasksWidget() {
  const components = useDesignComponents();
  return <components.UpcomingTasksWidget />;
}
