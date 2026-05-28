"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Scale, ArrowLeftRight, PiggyBank, TrendingUp,
  Link2, Sun, Moon, Wallet, List, Info, Sparkles,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import PacioliLogo from "@/components/pacioli-logo";

const ONBOARDING_KEY = "pacioli-onboarded";

const links = [
  { href: "/",              label: "Zoom Out",                   sublabel: "Summary",         icon: LayoutDashboard },
  { href: "/net-worth",     label: "My Net Worth",               sublabel: "Balance Sheet",   icon: Scale },
  { href: "/cash-flow",     label: "How My Money Moves",         sublabel: "Cash Flow",       icon: ArrowLeftRight },
  { href: "/transactions",  label: "All Transactions",           sublabel: "Search & Filter", icon: List },
  { href: "/budget",        label: "My Budget",                  sublabel: "Envelopes & AI",  icon: Wallet },
  { href: "/sinking-funds", label: "Achieve My Goals",           sublabel: "Sinking Funds",   icon: PiggyBank },
  { href: "/forecast",      label: "What the Future Looks Like", sublabel: "12-Mo Forecast",  icon: TrendingUp },
  { href: "/connect",       label: "Connect Data",               sublabel: "Accounts & CSV",  icon: Link2 },
];

export default function Nav() {
  const path = usePathname();
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  // Show "Getting Started" tab only until the user dismisses onboarding
  const [showGettingStarted, setShowGettingStarted] = useState(false);

  useEffect(() => {
    function check() {
      try {
        const s = JSON.parse(localStorage.getItem(ONBOARDING_KEY) ?? "null");
        setShowGettingStarted(!s?.dismissed);
      } catch {
        setShowGettingStarted(true);
      }
    }
    check();
    // Re-check whenever localStorage changes (e.g. user completes steps on the page)
    window.addEventListener("storage", check);
    return () => window.removeEventListener("storage", check);
  }, []);

  // Also re-check when navigating away from /getting-started (steps may have been completed)
  useEffect(() => {
    if (path !== "/getting-started") {
      try {
        const s = JSON.parse(localStorage.getItem(ONBOARDING_KEY) ?? "null");
        setShowGettingStarted(!s?.dismissed);
      } catch {
        setShowGettingStarted(true);
      }
    }
  }, [path]);

  return (
    <nav className="pacioli-bg-nav border-r w-64 h-full flex flex-col py-8 px-4 shrink-0">
      {/* Brand */}
      <div className="mb-8 px-3 flex items-center justify-between">
        <PacioliLogo size={32} variant="wordmark" theme={isDark ? "dark" : "light"} />
        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="p-1.5 rounded-lg pacioli-text-muted hover:pacioli-text-primary transition-all"
          style={{ transition: "color 0.15s" }}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>

      {/* Nav links */}
      <div className="flex flex-col gap-1 flex-1 justify-between">
        <div className="flex flex-col gap-1">
          {/* Getting Started — first tab, only shown until dismissed */}
          {showGettingStarted && (
            <Link
              href="/getting-started"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${
                path === "/getting-started"
                  ? "pacioli-bg-nav-active pacioli-text-nav-active"
                  : "text-indigo-400 bg-indigo-600/10 hover:bg-indigo-600/20"
              }`}
            >
              <Sparkles size={18} className={path === "/getting-started" ? "pacioli-icon-active" : "text-indigo-400"} />
              <div>
                <p className="text-sm font-medium leading-none">Getting Started</p>
                <p className={`text-[11px] mt-0.5 ${path === "/getting-started" ? "opacity-70" : "text-indigo-400/70"}`}>Setup checklist</p>
              </div>
            </Link>
          )}

          {/* Divider after Getting Started */}
          {showGettingStarted && (
            <div className="my-1 border-t pacioli-border-subtle mx-1" />
          )}

          {links.map(({ href, label, sublabel, icon: Icon }) => {
            const active = path === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${
                  active
                    ? "pacioli-bg-nav-active pacioli-text-nav-active"
                    : "pacioli-text-muted pacioli-bg-nav-hover"
                }`}
              >
                <Icon size={18} className={active ? "pacioli-icon-active" : "pacioli-icon-muted"} />
                <div>
                  <p className="text-sm font-medium leading-none">{label}</p>
                  <p className={`text-[11px] mt-0.5 ${active ? "opacity-70" : "pacioli-text-muted"}`}>{sublabel}</p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Footer — About link (larger/more visible) */}
        <Link
          href="/about"
          className={`flex items-center gap-2.5 px-3 py-3 rounded-xl text-sm font-medium transition-colors border ${
            path === "/about"
              ? "pacioli-bg-nav-active pacioli-text-nav-active border-indigo-500/30"
              : "pacioli-text-secondary hover:pacioli-text-primary pacioli-border-subtle hover:border-indigo-500/30"
          }`}
        >
          <Info size={15} />
          About Pacioli
        </Link>
      </div>
    </nav>
  );
}
