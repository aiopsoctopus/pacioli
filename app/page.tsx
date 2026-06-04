"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Shield, Cpu, BarChart3, Target, TrendingUp, Wallet, Sun, Moon } from "lucide-react";
import PacioliLogo from "@/components/pacioli-logo";

const FEATURES = [
  {
    icon: BarChart3,
    title: "Net Worth at a glance",
    body: "Every account, every month, in one clean balance sheet. Watch your number go up.",
  },
  {
    icon: Wallet,
    title: "Envelope budgeting",
    body: "Analyses 6 months of your spending and suggests category budgets — you tweak, accept, done.",
  },
  {
    icon: TrendingUp,
    title: "12-month forecast",
    body: "See exactly where your net worth will be in a year based on your actual income and habits.",
  },
  {
    icon: Target,
    title: "Sinking funds",
    body: "Name a goal, set a target, contribute monthly. Pacioli tracks progress so you never lose sight.",
  },
  {
    icon: Cpu,
    title: "Smart categorization",
    body: "Teach Pacioli a rule once — 'Trader Joe's = Groceries' — and it applies forever across every import.",
  },
  {
    icon: Shield,
    title: "100% private",
    body: "No accounts, no servers, no telemetry. Your numbers live in your browser and nowhere else.",
  },
];

const STAT_ITEMS = [
  { value: "100%", label: "Private — your data never leaves your device" },
  { value: "6mo", label: "Of spending history analysed per budget category" },
  { value: "12mo", label: "Net worth forecast based on your real numbers" },
  { value: "0", label: "Subscriptions, trackers, or third-party accounts" },
];

/* ── Warm Stone palette ──────────────────────────────────────────── */
const LIGHT = {
  pageBg:        "#faf8f4",
  navBg:         "rgba(250,248,244,0.9)",
  navBorder:     "#e5dfd6",
  surfaceBg:     "#ffffff",
  surfaceBorder: "#e5dfd6",
  cardBg:        "#ffffff",
  cardBorder:    "#e5dfd6",
  statsStripBg:  "#f3f0ea",
  statsStripBorder: "#e5dfd6",
  originBg:      "#f3f0ea",
  originBorder:  "#e5dfd6",
  textPrimary:   "#1e1a14",
  textSecondary: "#78705e",
  textMuted:     "#a89f8e",
  textTrust:     "#78705e",
  eyebrowBg:     "#e0f4f4",
  eyebrowBorder: "#9dd4d4",
  eyebrowText:   "#0d6e6e",
  eyebrowDot:    "#0d6e6e",
  ctaPrimary:    "#0d6e6e",
  ctaPrimaryHover:"#0a5858",
  ctaSecondaryBg:"transparent",
  ctaSecondaryBorder:"#d6cfc4",
  ctaSecondaryText:"#4a4235",
  statValue:     "#0d6e6e",
  statLabel:     "#78705e",
  iconBg:        "#e0f4f4",
  iconColor:     "#0d6e6e",
  footerBorder:  "#e5dfd6",
  footerText:    "#a89f8e",
  footerLink:    "#78705e",
  pronunciationColor: "#a89f8e",
  emText:        "#4a4235",
  toggleBg:      "#e5dfd6",
  toggleColor:   "#78705e",
};

const DARK = {
  pageBg:        "#1a1510",
  navBg:         "rgba(26,21,16,0.9)",
  navBorder:     "#2e2820",
  surfaceBg:     "#221d17",
  surfaceBorder: "#2e2820",
  cardBg:        "#221d17",
  cardBorder:    "#2e2820",
  statsStripBg:  "#1f1a14",
  statsStripBorder: "#2e2820",
  originBg:      "#1f1a14",
  originBorder:  "#2e2820",
  textPrimary:   "#f0ece4",
  textSecondary: "#a89f8e",
  textMuted:     "#6b6048",
  textTrust:     "#6b6048",
  eyebrowBg:     "rgba(13,110,110,0.18)",
  eyebrowBorder: "rgba(13,110,110,0.35)",
  eyebrowText:   "#5dcaa5",
  eyebrowDot:    "#5dcaa5",
  ctaPrimary:    "#0d6e6e",
  ctaPrimaryHover:"#0a5858",
  ctaSecondaryBg:"rgba(13,110,110,0.12)",
  ctaSecondaryBorder:"rgba(93,202,165,0.2)",
  ctaSecondaryText:"#a89f8e",
  statValue:     "#5dcaa5",
  statLabel:     "#78705e",
  iconBg:        "rgba(13,110,110,0.2)",
  iconColor:     "#5dcaa5",
  footerBorder:  "#2e2820",
  footerText:    "#4a4235",
  footerLink:    "#6b6048",
  pronunciationColor: "#6b6048",
  emText:        "#a89f8e",
  toggleBg:      "#2e2820",
  toggleColor:   "#a89f8e",
};

export default function LandingPage() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Respect stored preference, default to light
    const stored = localStorage.getItem("pacioli-landing-theme");
    setIsDark(stored === "dark");
  }, []);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem("pacioli-landing-theme", next ? "dark" : "light");
  }

  function handleTryDemo() {
    localStorage.setItem("pacioli-demo-mode", "true");
    localStorage.setItem("pacioli-setup-complete", "demo");
    // Always force light mode for sandbox — demo should look its best
    localStorage.setItem("hfos-theme", "light");
    document.documentElement.setAttribute("data-theme", "light");
    window.location.href = "/zoom-out?demo=true";
  }

  const c = isDark ? DARK : LIGHT;

  // Prevent flash before mount
  if (!mounted) return <div style={{ background: LIGHT.pageBg, minHeight: "100vh" }} />;

  return (
    <div style={{ background: c.pageBg, minHeight: "100vh", color: c.textPrimary, transition: "background 0.2s, color 0.2s" }}>

      {/* ── Navbar ─────────────────────────────────────────── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        background: c.navBg,
        backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${c.navBorder}`,
        padding: "0 2rem",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: "60px",
        transition: "background 0.2s, border-color 0.2s",
      }}>
        <PacioliLogo size={30} variant="wordmark" theme={isDark ? "dark" : "light"} />

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {/* Dark mode toggle */}
          <button
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            style={{
              background: c.toggleBg,
              border: "none",
              borderRadius: "8px",
              color: c.toggleColor,
              width: "34px", height: "34px",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
              transition: "background 0.2s, color 0.2s",
            }}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <button
            onClick={handleTryDemo}
            style={{
              background: "transparent",
              border: `1px solid ${c.ctaSecondaryBorder}`,
              borderRadius: "8px",
              color: c.ctaSecondaryText,
              padding: "6px 16px",
              fontSize: "13px",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            Try demo
          </button>
          <Link
            href="/sign-up"
            style={{
              background: c.ctaPrimary,
              borderRadius: "8px",
              color: "#fff",
              padding: "6px 16px",
              fontSize: "13px",
              fontWeight: 600,
              textDecoration: "none",
              transition: "background 0.15s",
            }}
          >
            Get started →
          </Link>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────── */}
      <section style={{
        maxWidth: "860px",
        margin: "0 auto",
        padding: "100px 2rem 80px",
        textAlign: "center",
      }}>
        {/* Eyebrow */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: "8px",
          background: c.eyebrowBg,
          border: `1px solid ${c.eyebrowBorder}`,
          borderRadius: "999px",
          padding: "5px 14px",
          fontSize: "12px",
          color: c.eyebrowText,
          fontWeight: 600,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          marginBottom: "32px",
          transition: "background 0.2s, border-color 0.2s, color 0.2s",
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.eyebrowDot, display: "inline-block" }} />
          Your household, run like a business
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: "clamp(2.6rem, 6vw, 4.2rem)",
          fontWeight: 800,
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          margin: "0 0 24px",
          color: c.textPrimary,
          transition: "color 0.2s",
        }}>
          Financial clarity,<br />without the complexity.
        </h1>

        {/* Sub */}
        <p style={{
          fontSize: "1.2rem",
          color: c.textSecondary,
          lineHeight: 1.7,
          maxWidth: "560px",
          margin: "0 auto 48px",
          transition: "color 0.2s",
        }}>
          Pacioli is a local-first personal finance OS — budget tracking, net worth, forecasting, and goal planning.
          Your data stays on your device. Always.
        </p>

        {/* CTAs */}
        <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/sign-up"
            style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              background: c.ctaPrimary,
              color: "#fff",
              padding: "14px 28px",
              borderRadius: "12px",
              fontWeight: 700,
              fontSize: "1rem",
              textDecoration: "none",
              transition: "background 0.15s",
            }}
          >
            Get started free <ArrowRight size={16} />
          </Link>
          <button
            onClick={handleTryDemo}
            style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              background: c.ctaSecondaryBg,
              border: `1px solid ${c.ctaSecondaryBorder}`,
              color: c.ctaSecondaryText,
              padding: "14px 28px",
              borderRadius: "12px",
              fontWeight: 600,
              fontSize: "1rem",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            Explore with sandbox data
          </button>
        </div>

        {/* Trust note */}
        <p style={{ marginTop: "24px", fontSize: "12px", color: c.textTrust, transition: "color 0.2s" }}>
          Free · No credit card · No tracking · Your data stays on your device
        </p>
      </section>

      {/* ── Stats bar ──────────────────────────────────────── */}
      <section style={{
        borderTop: `1px solid ${c.statsStripBorder}`,
        borderBottom: `1px solid ${c.statsStripBorder}`,
        background: c.statsStripBg,
        padding: "40px 2rem",
        transition: "background 0.2s, border-color 0.2s",
      }}>
        <div style={{
          maxWidth: "900px", margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "32px",
          textAlign: "center",
        }}>
          {STAT_ITEMS.map((s) => (
            <div key={s.value}>
              <div style={{ fontSize: "2.4rem", fontWeight: 800, color: c.statValue, lineHeight: 1, transition: "color 0.2s" }}>{s.value}</div>
              <div style={{ fontSize: "12px", color: c.statLabel, marginTop: "8px", lineHeight: 1.5, transition: "color 0.2s" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features grid ──────────────────────────────────── */}
      <section style={{ maxWidth: "900px", margin: "0 auto", padding: "80px 2rem" }}>
        <h2 style={{
          textAlign: "center",
          fontSize: "1.8rem",
          fontWeight: 700,
          color: c.textPrimary,
          marginBottom: "12px",
          transition: "color 0.2s",
        }}>
          Everything your finances need
        </h2>
        <p style={{ textAlign: "center", color: c.textSecondary, marginBottom: "48px", fontSize: "1rem", transition: "color 0.2s" }}>
          Built on the same double-entry principles Luca Pacioli invented in 1494.
        </p>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "20px",
        }}>
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              style={{
                background: c.cardBg,
                border: `1px solid ${c.cardBorder}`,
                borderRadius: "16px",
                padding: "28px",
                transition: "background 0.2s, border-color 0.2s",
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: "10px",
                background: c.iconBg,
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: "16px",
                color: c.iconColor,
                transition: "background 0.2s, color 0.2s",
              }}>
                <Icon size={20} />
              </div>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: c.textPrimary, marginBottom: "8px", transition: "color 0.2s" }}>{title}</h3>
              <p style={{ fontSize: "14px", color: c.textSecondary, lineHeight: 1.65, margin: 0, transition: "color 0.2s" }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ─────────────────────────────────────── */}
      <section style={{ textAlign: "center", padding: "80px 2rem 100px" }}>
        <h2 style={{ fontSize: "2rem", fontWeight: 700, color: c.textPrimary, marginBottom: "12px", transition: "color 0.2s" }}>
          Ready to see your real picture?
        </h2>
        <p style={{ color: c.textSecondary, marginBottom: "40px", fontSize: "1rem", transition: "color 0.2s" }}>
          Takes 2 minutes. Free to sign up.
        </p>
        <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/sign-up"
            style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              background: c.ctaPrimary,
              color: "#fff",
              padding: "14px 28px",
              borderRadius: "12px",
              fontWeight: 700,
              fontSize: "1rem",
              textDecoration: "none",
              transition: "background 0.15s",
            }}
          >
            Get started <ArrowRight size={16} />
          </Link>
          <button
            onClick={handleTryDemo}
            style={{
              background: "transparent",
              border: `1px solid ${c.ctaSecondaryBorder}`,
              color: c.ctaSecondaryText,
              padding: "14px 28px",
              borderRadius: "12px",
              fontSize: "1rem",
              cursor: "pointer",
              transition: "border-color 0.2s, color 0.2s",
            }}
          >
            Try sandbox first
          </button>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer style={{
        borderTop: `1px solid ${c.footerBorder}`,
        padding: "24px 2rem",
        textAlign: "center",
        fontSize: "12px",
        color: c.footerText,
        transition: "border-color 0.2s, color 0.2s",
      }}>
        Built by{" "}
        <a href="https://www.linkedin.com/in/christina-moore-94b54a23/" target="_blank" rel="noopener noreferrer" style={{ color: c.footerLink, textDecoration: "none" }}>
          Christina Moore
        </a>
        {" · "}
        <a href="https://aiopsoctopus.substack.com" target="_blank" rel="noopener noreferrer" style={{ color: c.footerLink, textDecoration: "none" }}>
          The AI Ops Octopus
        </a>
        {" "}🐙
      </footer>
    </div>
  );
}
