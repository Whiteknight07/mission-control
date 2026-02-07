"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

export type DesignVariant = "neon-brutalist" | "soft-gradient" | "retro-terminal" | "glass-morphism" | "minimal-mono";

const STORAGE_KEY = "mission-control:design-variant:v1";
const STORAGE_EVENT = "mission-control:design-variant:change";
const DEFAULT_VARIANT: DesignVariant = "neon-brutalist";

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

let inMemoryVariant: DesignVariant = DEFAULT_VARIANT;

function isDesignVariant(value: string | null): value is DesignVariant {
  return value === "neon-brutalist" || value === "soft-gradient" || value === "retro-terminal" || value === "glass-morphism" || value === "minimal-mono";
}

function readVariantSnapshot(): DesignVariant {
  if (typeof window === "undefined") {
    return inMemoryVariant;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isDesignVariant(stored)) {
      inMemoryVariant = stored;
      return stored;
    }
  } catch {
    // Ignore storage errors
  }

  return inMemoryVariant;
}

function subscribeToVariantChange(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      onStoreChange();
    }
  };

  const handleVariantChange = () => onStoreChange();

  window.addEventListener("storage", handleStorage);
  window.addEventListener(STORAGE_EVENT, handleVariantChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(STORAGE_EVENT, handleVariantChange);
  };
}

type DesignContextValue = {
  variant: DesignVariant;
  setVariant: (variant: DesignVariant) => void;
  variants: DesignVariant[];
  getMeta: (variant: DesignVariant) => (typeof designMeta)[DesignVariant];
};

const DesignContext = createContext<DesignContextValue | null>(null);

export function DesignProvider({ children }: { children: ReactNode }) {
  const variant = useSyncExternalStore(
    subscribeToVariantChange,
    readVariantSnapshot,
    () => DEFAULT_VARIANT
  );

  const setVariant = (next: DesignVariant) => {
    inMemoryVariant = next;

    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, next);
      }
    } catch {
      // Ignore storage errors
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(STORAGE_EVENT));
    }
  };

  const getMeta = (v: DesignVariant) => designMeta[v];

  const variants = Object.keys(designMeta) as DesignVariant[];

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
