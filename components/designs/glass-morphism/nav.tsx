"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, Layers, Radar, Search } from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Overview", icon: Home },
  { href: "/activity", label: "Activity", icon: Radar },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/search", label: "Search", icon: Search },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop - Floating glass sidebar */}
      <aside className="fixed inset-y-5 left-5 z-40 hidden w-60 flex-col overflow-hidden rounded-3xl border border-white/20 bg-white/10 shadow-2xl shadow-black/20 backdrop-blur-2xl md:flex">
        {/* Logo area */}
        <div className="border-b border-white/10 p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-white/30 to-white/10 shadow-inner shadow-white/20">
              <Layers className="size-5 text-white" />
            </div>
            <div>
              <p className="text-[11px] font-medium tracking-wide text-white/60">Mission</p>
              <p className="text-lg font-semibold tracking-tight text-white">Control</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col gap-1.5 p-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200",
                  isActive
                    ? "bg-white/20 text-white shadow-lg shadow-white/10"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                )}
              >
                <div
                  className={cn(
                    "flex size-8 items-center justify-center rounded-lg transition-all",
                    isActive
                      ? "bg-white/30 shadow-inner shadow-white/20"
                      : "bg-white/5 group-hover:bg-white/10"
                  )}
                >
                  <Icon className="size-4" />
                </div>
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Status footer */}
        <div className="border-t border-white/10 p-4">
          <div className="rounded-xl bg-white/5 p-3">
            <div className="flex items-center gap-2">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
              </span>
              <span className="text-xs font-medium text-white/80">Realtime Connected</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile - Floating bottom glass bar */}
      <nav className="fixed inset-x-4 bottom-4 z-50 grid h-16 grid-cols-4 gap-1 rounded-2xl border border-white/20 bg-white/10 p-1.5 shadow-2xl shadow-black/20 backdrop-blur-2xl md:hidden">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium transition-all",
                isActive
                  ? "bg-white/20 text-white shadow-inner shadow-white/10"
                  : "text-white/60"
              )}
            >
              <Icon className="size-5" />
              {item.label.split(" ")[0]}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
