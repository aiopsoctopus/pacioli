"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";

const DEMO_STORAGE_KEY = "pacioli-demo-mode";

interface DemoContextValue {
  isDemo: boolean;
  enterDemo: () => void;
  exitDemo: () => void;
  /** Namespaced localStorage key — demo reads/writes use "demo-{key}" */
  storageKey: (key: string) => string;
}

const DemoContext = createContext<DemoContextValue>({
  isDemo: false,
  enterDemo: () => {},
  exitDemo: () => {},
  storageKey: (k) => k,
});

function resolveIsDemo(): boolean {
  if (typeof window === "undefined") return false;
  // URL param takes priority — ?demo=true enters demo, ?demo=false exits
  const params = new URLSearchParams(window.location.search);
  if (params.has("demo")) {
    const urlDemo = params.get("demo") === "true";
    localStorage.setItem(DEMO_STORAGE_KEY, String(urlDemo));
    return urlDemo;
  }
  // Real-setup users are never in demo mode — clear any stale flag
  const setupComplete = localStorage.getItem("pacioli-setup-complete");
  if (setupComplete === "true") {
    localStorage.setItem(DEMO_STORAGE_KEY, "false");
    return false;
  }
  return localStorage.getItem(DEMO_STORAGE_KEY) === "true";
}

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [isDemo, setIsDemo] = useState<boolean>(() => resolveIsDemo());

  const enterDemo = useCallback(() => {
    setIsDemo(true);
    localStorage.setItem(DEMO_STORAGE_KEY, "true");
    localStorage.setItem("pacioli-setup-complete", "demo");
    // Set cookie so middleware allows navigation without auth
    document.cookie = "pacioli-demo-mode=true; path=/; samesite=lax";
    // Default to light mode when entering sandbox
    localStorage.setItem("hfos-theme", "light");
    document.documentElement.setAttribute("data-theme", "light");
    // Update URL without reload so the link stays shareable
    const url = new URL(window.location.href);
    url.searchParams.set("demo", "true");
    window.history.replaceState({}, "", url.toString());
  }, []);

  const exitDemo = useCallback(() => {
    setIsDemo(false);
    localStorage.setItem(DEMO_STORAGE_KEY, "false");
    localStorage.removeItem("pacioli-setup-complete");
    localStorage.removeItem("pacioli-setup-banner-dismissed");
    // Clear demo cookie so middleware resumes auth requirement
    document.cookie = "pacioli-demo-mode=false; path=/; samesite=lax; max-age=0";
    const url = new URL(window.location.href);
    url.searchParams.delete("demo");
    window.history.replaceState({}, "", url.toString());
  }, []);

  const storageKey = useCallback(
    (key: string) => (isDemo ? `demo-${key}` : key),
    [isDemo]
  );

  return (
    <DemoContext.Provider value={{ isDemo, enterDemo, exitDemo, storageKey }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  return useContext(DemoContext);
}
