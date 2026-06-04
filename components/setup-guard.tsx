"use client";
/**
 * SetupGuard — soft redirect
 *
 * Now that auth exists, any signed-in user is considered "set up".
 * We auto-mark setup complete on mount so the guard never fires for
 * authenticated users. It only shows the nudge banner if somehow
 * setup is missing AND the user isn't in demo mode AND hasn't dismissed.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, X } from "lucide-react";
import { useAuth } from "@clerk/nextjs";

const SETUP_KEY = "pacioli-setup-complete";
const DEMO_KEY  = "pacioli-demo-mode";
const DISMISS_BANNER_KEY = "pacioli-setup-banner-dismissed";

export default function SetupGuard() {
  const { isSignedIn } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Authenticated users are always considered set up
    if (isSignedIn) {
      localStorage.setItem(SETUP_KEY, "true");
      return;
    }

    const setupDone = localStorage.getItem(SETUP_KEY);
    const isDemo    = localStorage.getItem(DEMO_KEY) === "true";
    const dismissed = localStorage.getItem(DISMISS_BANNER_KEY) === "true";

    if (!setupDone && !isDemo && !dismissed) {
      setShow(true);
    }
  }, [isSignedIn]);

  function dismiss() {
    localStorage.setItem(DISMISS_BANNER_KEY, "true");
    setShow(false);
  }

  if (!show) return null;

  return (
    <div style={{
      background: "rgba(83,74,183,0.15)",
      borderBottom: "1px solid rgba(83,74,183,0.3)",
      padding: "10px 24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "16px",
      flexWrap: "wrap",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <Sparkles size={14} style={{ color: "#AFA9EC", flexShrink: 0 }} />
        <span style={{ fontSize: "13px", color: "#c8c4f0" }}>
          You're seeing sample data.{" "}
          <Link
            href="/setup"
            style={{ color: "#AFA9EC", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: "2px" }}
          >
            Run setup
          </Link>
          {" "}to connect your own numbers — takes 2 minutes.
        </span>
      </div>
      <button
        onClick={dismiss}
        style={{
          background: "transparent",
          border: "none",
          color: "#7f77dd",
          cursor: "pointer",
          padding: "4px",
          display: "flex",
          alignItems: "center",
        }}
        title="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
