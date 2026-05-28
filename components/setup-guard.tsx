"use client";
/**
 * SetupGuard — soft redirect
 *
 * If the user has never been through /setup AND is not in demo mode,
 * shows a gentle banner nudging them toward setup. It does NOT hard-block
 * navigation — the user can dismiss and use the app freely.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, X } from "lucide-react";

const SETUP_KEY = "pacioli-setup-complete";
const DEMO_KEY  = "pacioli-demo-mode";
const DISMISS_BANNER_KEY = "pacioli-setup-banner-dismissed";

export default function SetupGuard() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const setupDone = localStorage.getItem(SETUP_KEY);
    const isDemo    = localStorage.getItem(DEMO_KEY) === "true";
    const dismissed = localStorage.getItem(DISMISS_BANNER_KEY) === "true";

    if (!setupDone && !isDemo && !dismissed) {
      setShow(true);
    }
  }, []);

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
