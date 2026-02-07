"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, Radar, Search, Sparkles } from "lucide-react";

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
      {/* Desktop - Floating pill sidebar */}
      <aside className="fixed inset-y-6 left-6 z-40 hidden w-56 flex-col overflow-hidden rounded-3xl bg-gradient-to-b from-violet-950/80 to-fuchsia-950/60 shadow-2xl shadow-violet-500/20 backdrop-blur-xl md:flex">
        <div className="border-b border-white/10 p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-400 to-fuchsia-500 shadow-lg shadow-violet-500/30">
              <Sparkles className="size-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-medium tracking-wide text-violet-300/80">Mission</p>
              <p className="text-lg font-semibold text-white">Control</p>
            </div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-2xl px-4 py-3 transition-all duration-300",
                  isActive
                    ? "bg-gradient-to-r from-violet-500/30 to-fuchsia-500/20 text-white shadow-lg shadow-violet-500/20"
                    : "text-violet-200/70 hover:bg-white/5 hover:text-white"
                )}
              >
                <div
                  className={cn(
                    "flex size-8 items-center justify-center rounded-xl transition-all",
                    isActive
                      ? "bg-gradient-to-br from-violet-400 to-fuchsia-500 shadow-md"
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

        <div className="border-t border-white/10 p-4">
          <div className="rounded-2xl bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 p-3">
            <p className="text-xs font-medium text-violet-300">Clawd Link</p>
            <p className="mt-0.5 text-[11px] text-violet-400/70">Realtime sync active</p>
          </div>
        </div>
      </aside>

      {/* Mobile - Floating bottom bar */}
      <nav className="fixed inset-x-4 bottom-4 z-50 grid h-16 grid-cols-4 gap-1 rounded-2xl bg-gradient-to-r from-violet-950/90 to-fuchsia-950/90 p-2 shadow-2xl shadow-violet-500/20 backdrop-blur-xl md:hidden">
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
                  ? "bg-gradient-to-b from-violet-500/30 to-fuchsia-500/20 text-white"
                  : "text-violet-300/70"
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
