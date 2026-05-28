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

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    // URL param takes priority — ?demo=true enters demo, ?demo=false exits
    const params = new URLSearchParams(window.location.search);
    if (params.has("demo")) {
      const urlDemo = params.get("demo") === "true";
      setIsDemo(urlDemo);
      localStorage.setItem(DEMO_STORAGE_KEY, String(urlDemo));
      return;
    }
    // Otherwise restore from localStorage
    const stored = localStorage.getItem(DEMO_STORAGE_KEY);
    if (stored === "true") setIsDemo(true);
  }, []);

  const enterDemo = useCallback(() => {
    setIsDemo(true);
    localStorage.setItem(DEMO_STORAGE_KEY, "true");
    localStorage.setItem("pacioli-setup-complete", "demo");
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
