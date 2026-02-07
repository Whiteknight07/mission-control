"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, Radar, Search, Zap } from "lucide-react";

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
      {/* Desktop - Vertical strip on left edge */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-20 flex-col bg-black border-r-4 border-[#ff00ff] md:flex">
        <div className="flex h-20 items-center justify-center border-b-4 border-[#ff00ff] bg-[#ff00ff]">
          <Zap className="size-8 text-black" strokeWidth={3} />
        </div>

        <nav className="flex flex-1 flex-col items-center gap-1 py-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex size-14 items-center justify-center transition-all duration-150",
                  isActive
                    ? "bg-[#ff00ff] text-black"
                    : "text-[#ff00ff] hover:bg-[#ff00ff]/20"
                )}
              >
                <Icon className="size-6" strokeWidth={isActive ? 3 : 2} />
                <span className="absolute left-full ml-3 hidden whitespace-nowrap bg-[#ff00ff] px-3 py-1.5 text-xs font-black uppercase tracking-widest text-black group-hover:block">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t-4 border-[#ff00ff] p-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#ff00ff]">MC</p>
          <div className="mt-1 h-1 w-full bg-[#ff00ff] animate-pulse" />
        </div>
      </aside>

      {/* Mobile - Bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-50 grid h-16 grid-cols-4 border-t-4 border-[#ff00ff] bg-black md:hidden">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 text-[9px] font-black uppercase tracking-widest",
                isActive ? "bg-[#ff00ff] text-black" : "text-[#ff00ff]"
              )}
            >
              <Icon className="size-5" strokeWidth={isActive ? 3 : 2} />
              {item.label.split(" ")[0]}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
