"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type DesignVariant = "neon-brutalist" | "soft-gradient" | "retro-terminal" | "glass-morphism" | "minimal-mono";

const STORAGE_KEY = "mission-control:design-variant:v1";

const designMeta: Record<DesignVariant, { label: string; description: string; emoji: string }> = {
  "neon-brutalist": {
    label: "Neon Brutalist",
    description: "Bold shapes, stark contrasts, electric accents",
    emoji: "N",
  },
  "soft-gradient": {
    label: "Soft Gradient",
    description: "Gentle purples, flowing gradients, smooth curves",
    emoji: "S",
  },
  "retro-terminal": {
    label: "Retro Terminal",
    description: "Green phosphor CRT aesthetic, scanlines, flicker",
    emoji: "R",
  },
  "glass-morphism": {
    label: "Glass Morphism",
    description: "Frosted glass, depth layers, subtle shadows",
    emoji: "G",
  },
  "minimal-mono": {
    label: "Minimal Mono",
    description: "Black and white, typography-focused, clean",
    emoji: "M",
  },
};

type DesignContextValue = {
  variant: DesignVariant;
  setVariant: (variant: DesignVariant) => void;
  variants: DesignVariant[];
  getMeta: (variant: DesignVariant) => (typeof designMeta)[DesignVariant];
};

const DesignContext = createContext<DesignContextValue | null>(null);

export function DesignProvider({ children }: { children: ReactNode }) {
  const [variant, setVariantState] = useState<DesignVariant>("neon-brutalist");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && Object.keys(designMeta).includes(stored)) {
        setVariantState(stored as DesignVariant);
      }
    } catch {
      // Ignore storage errors
    }
    setHydrated(true);
  }, []);

  const setVariant = (next: DesignVariant) => {
    setVariantState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage errors
    }
  };

  const getMeta = (v: DesignVariant) => designMeta[v];

  const variants = Object.keys(designMeta) as DesignVariant[];

  if (!hydrated) {
    return null;
  }

  return (
    <DesignContext.Provider value={{ variant, setVariant, variants, getMeta }}>
      {children}
    </DesignContext.Provider>
  );
}

export function useDesign() {
  const context = useContext(DesignContext);
  if (!context) {
    throw new Error("useDesign must be used within a DesignProvider");
  }
  return context;
}
