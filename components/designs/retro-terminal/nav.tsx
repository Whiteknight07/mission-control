"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, Radar, Search } from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "home", icon: Home, cmd: "cd ~" },
  { href: "/activity", label: "activity", icon: Radar, cmd: "tail -f" },
  { href: "/calendar", label: "calendar", icon: CalendarDays, cmd: "crontab" },
  { href: "/search", label: "search", icon: Search, cmd: "grep -r" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop - Terminal window sidebar */}
      <aside className="fixed inset-y-4 left-4 z-40 hidden w-72 flex-col overflow-hidden rounded border border-[#33ff33]/50 bg-black font-mono md:flex">
        {/* Title bar */}
        <div className="flex items-center gap-2 border-b border-[#33ff33]/30 bg-[#33ff33]/10 px-3 py-2">
          <div className="flex gap-1.5">
            <div className="size-2.5 rounded-full bg-[#ff5f56]" />
            <div className="size-2.5 rounded-full bg-[#ffbd2e]" />
            <div className="size-2.5 rounded-full bg-[#27c93f]" />
          </div>
          <span className="flex-1 text-center text-[10px] text-[#33ff33]/70">mission-control — bash</span>
        </div>

        {/* Terminal content */}
        <div className="flex-1 p-3 text-xs">
          <div className="mb-3 text-[#33ff33]/70">
            <p suppressHydrationWarning>Last login: {new Date().toLocaleDateString()}</p>
            <p className="mt-1">Welcome to Mission Control v1.0.0</p>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-2 py-1.5 transition-all",
                    isActive ? "text-[#33ff33]" : "text-[#33ff33]/60 hover:text-[#33ff33]"
                  )}
                >
                  <span className={cn("transition-all", isActive ? "text-[#33ff33]" : "text-[#33ff33]/40")}>
                    {isActive ? ">" : "$"}
                  </span>
                  <span>{item.cmd}</span>
                  <span className="text-[#33ff33]/40">#{item.label}</span>
                  {isActive && <span className="animate-pulse">_</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Status bar */}
        <div className="border-t border-[#33ff33]/30 bg-[#33ff33]/5 px-3 py-2 text-[10px] text-[#33ff33]/50">
          <div className="flex items-center justify-between">
            <span>PID: 1337</span>
            <span className="flex items-center gap-1">
              <span className="size-1.5 animate-pulse rounded-full bg-[#33ff33]" />
              CONNECTED
            </span>
          </div>
        </div>

        {/* CRT scanline effect */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px]" />
      </aside>

      {/* Mobile - Bottom terminal bar */}
      <nav className="fixed inset-x-2 bottom-2 z-50 grid h-14 grid-cols-4 gap-1 rounded border border-[#33ff33]/50 bg-black p-1 font-mono md:hidden">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 rounded text-[9px]",
                isActive ? "bg-[#33ff33]/20 text-[#33ff33]" : "text-[#33ff33]/50"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
        {/* Mobile scanline */}
        <div className="pointer-events-none absolute inset-0 rounded bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px]" />
      </nav>
    </>
  );
}
