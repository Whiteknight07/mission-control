"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, Radar, Search } from "lucide-react";

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
      {/* Desktop - Clean sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-neutral-800 bg-neutral-950 md:flex">
        <div className="border-b border-neutral-800 p-6">
          <h1 className="text-lg font-light tracking-tight text-white">Mission Control</h1>
          <p className="mt-1 text-xs text-neutral-500">Agent Monitoring</p>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 p-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 text-sm transition-colors",
                  isActive
                    ? "bg-white text-black"
                    : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
                )}
              >
                <Icon className="size-4" strokeWidth={1.5} />
                <span className="font-light">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-neutral-800 p-4">
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-white" />
            <span className="text-xs text-neutral-500">Connected</span>
          </div>
        </div>
      </aside>

      {/* Mobile - Bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-50 grid h-14 grid-cols-4 border-t border-neutral-800 bg-neutral-950 md:hidden">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 text-[10px]",
                isActive ? "bg-white text-black" : "text-neutral-500"
              )}
            >
              <Icon className="size-4" strokeWidth={1.5} />
              {item.label.split(" ")[0]}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
