"use client";

import { useDesign, type DesignVariant } from "./design-provider";
import { cn } from "@/lib/utils";

export function DesignSwitcher() {
  const { variant, setVariant, variants, getMeta } = useDesign();

  return (
    <div className="fixed inset-x-0 bottom-0 z-[200] border-t border-white/10 bg-black/90 backdrop-blur-xl md:bottom-auto md:top-0 md:border-b md:border-t-0">
      <div className="mx-auto flex h-12 max-w-[1600px] items-center justify-between gap-2 px-3 md:px-4">
        <span className="hidden text-xs font-medium text-white/50 sm:block">Design</span>

        <div className="flex flex-1 items-center justify-center gap-1 overflow-x-auto sm:justify-start sm:gap-2">
          {variants.map((v) => {
            const meta = getMeta(v);
            const isActive = variant === v;

            return (
              <button
                key={v}
                onClick={() => setVariant(v)}
                className={cn(
                  "group relative flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-all sm:px-3",
                  isActive
                    ? "bg-white text-black"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                )}
              >
                <span className="font-medium">{meta.label}</span>

                {/* Tooltip on hover */}
                <span className="pointer-events-none absolute -top-10 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-white px-2 py-1 text-[10px] text-black opacity-0 shadow-lg transition-opacity group-hover:opacity-100 md:block">
                  {meta.description}
                </span>
              </button>
            );
          })}
        </div>

        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden shrink-0 text-[10px] text-white/30 hover:text-white/50 sm:block"
        >
          Design System
        </a>
      </div>
    </div>
  );
}
