"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Scale, ArrowLeftRight, PiggyBank, TrendingUp, Link2, Sun, Moon, Wallet, List, Info } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

const links = [
  { href: "/",              label: "Zoom Out",                   sublabel: "Summary",        icon: LayoutDashboard },
  { href: "/net-worth",     label: "My Net Worth",               sublabel: "Balance Sheet",  icon: Scale },
  { href: "/cash-flow",     label: "How My Money Moves",         sublabel: "Cash Flow",      icon: ArrowLeftRight },
  { href: "/transactions",  label: "All Transactions",           sublabel: "Search & Filter", icon: List },
  { href: "/budget",        label: "My Budget",                  sublabel: "Envelopes & AI", icon: Wallet },
  { href: "/sinking-funds", label: "Achieve My Goals",           sublabel: "Sinking Funds",  icon: PiggyBank },
  { href: "/forecast",      label: "What the Future Looks Like", sublabel: "12-Mo Forecast", icon: TrendingUp },
  { href: "/connect",       label: "Connect Data",               sublabel: "Accounts & CSV", icon: Link2 },
];

export default function Nav() {
  const path = usePathname();
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <nav className="pacioli-bg-nav border-r w-64 min-h-screen flex flex-col py-8 px-4 shrink-0">
      {/* Brand */}
      <div className="mb-8 px-3 flex items-center justify-between">
        <div>
          <h1 className="pacioli-text-primary font-bold text-xl tracking-tight">Pacioli</h1>
          <p className="text-[11px] pacioli-text-muted mt-0.5">Household Financial OS</p>
        </div>
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

        {/* Footer */}
        <Link
          href="/about"
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors ${
            path === "/about"
              ? "pacioli-bg-nav-active pacioli-text-nav-active"
              : "pacioli-text-faint hover:pacioli-text-muted"
          }`}
        >
          <Info size={13} />
          About Pacioli
        </Link>
      </div>
    </nav>
  );
}
