"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, Radar, Search, TerminalSquare } from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Overview", icon: Home },
  { href: "/activity", label: "Activity Feed", icon: Radar },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/search", label: "Search", icon: Search },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <>
      <aside className="panel-frame fixed inset-y-4 left-4 z-40 hidden w-64 flex-col overflow-hidden rounded-2xl md:flex">
        <div className="border-b border-border/70 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-primary/40 bg-primary/10 p-2 text-primary shadow-[0_0_24px_-8px_var(--color-primary)]">
              <TerminalSquare className="size-4" />
            </div>
            <div>
              <p className="font-display text-sm uppercase tracking-[0.28em] text-primary/90">Mission</p>
              <p className="font-display text-lg uppercase tracking-[0.18em] text-foreground">Control</p>
            </div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-2 p-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition",
                  isActive
                    ? "border-primary/60 bg-primary/10 text-primary shadow-[0_0_18px_-8px_var(--color-primary)]"
                    : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/35 hover:text-foreground",
                )}
              >
                <Icon className={cn("size-4", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                <span className="font-display text-[12px] uppercase tracking-[0.18em]">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border/70 p-4 text-xs text-muted-foreground">
          <p className="font-display uppercase tracking-[0.18em] text-primary/80">Clawd Link</p>
          <p className="mt-1 font-mono text-[11px]">Realtime telemetry online</p>
        </div>
      </aside>

      <nav className="panel-frame fixed inset-x-3 bottom-3 z-50 grid h-16 grid-cols-4 rounded-xl p-2 md:hidden">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center rounded-lg text-[10px] uppercase tracking-[0.12em]",
                isActive ? "bg-primary/15 text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="mb-1 size-4" />
              {item.label.split(" ")[0]}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
