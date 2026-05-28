"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Shield, Cpu, BarChart3, Target, TrendingUp, Wallet } from "lucide-react";
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
    body: "AI analyses 6 months of your spending and suggests category budgets — you tweak, accept, done.",
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

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  function handleTryDemo() {
    localStorage.setItem("pacioli-demo-mode", "true");
    localStorage.setItem("pacioli-setup-complete", "demo");
    window.location.href = "/zoom-out?demo=true";
  }

  return (
    <div style={{ background: "#0e0c1e", minHeight: "100vh", color: "#f0effe" }}>

      {/* ── Navbar ─────────────────────────────────────────── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(14,12,30,0.85)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(175,169,236,0.1)",
        padding: "0 2rem",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: "60px",
      }}>
        <PacioliLogo size={30} variant="wordmark" theme="dark" />
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <button
            onClick={handleTryDemo}
            style={{
              background: "transparent",
              border: "1px solid rgba(175,169,236,0.3)",
              borderRadius: "8px",
              color: "#c8c4f0",
              padding: "6px 16px",
              fontSize: "13px",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "#534AB7")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(175,169,236,0.3)")}
          >
            Try demo
          </button>
          <Link
            href="/setup"
            style={{
              background: "#534AB7",
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
          background: "rgba(83,74,183,0.18)",
          border: "1px solid rgba(83,74,183,0.35)",
          borderRadius: "999px",
          padding: "5px 14px",
          fontSize: "12px",
          color: "#AFA9EC",
          fontWeight: 600,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          marginBottom: "32px",
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#5dcaa5", display: "inline-block" }} />
          Your household, run like a business
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: "clamp(2.6rem, 6vw, 4.2rem)",
          fontWeight: 800,
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          margin: "0 0 24px",
          background: "linear-gradient(135deg, #f0effe 0%, #AFA9EC 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}>
          Financial clarity,<br />without the complexity.
        </h1>

        {/* Sub */}
        <p style={{
          fontSize: "1.2rem",
          color: "#7f77dd",
          lineHeight: 1.7,
          maxWidth: "560px",
          margin: "0 auto 48px",
        }}>
          Pacioli is a local-first personal finance OS — budget tracking, net worth, forecasting, and goal planning.
          Your data stays on your device. Always.
        </p>

        {/* CTAs */}
        <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/setup"
            style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              background: "#534AB7",
              color: "#fff",
              padding: "14px 28px",
              borderRadius: "12px",
              fontWeight: 700,
              fontSize: "1rem",
              textDecoration: "none",
              boxShadow: "0 0 40px rgba(83,74,183,0.4)",
              transition: "all 0.15s",
            }}
          >
            Get started free <ArrowRight size={16} />
          </Link>
          <button
            onClick={handleTryDemo}
            style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              background: "rgba(83,74,183,0.15)",
              border: "1px solid rgba(175,169,236,0.25)",
              color: "#c8c4f0",
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
        <p style={{ marginTop: "24px", fontSize: "12px", color: "#534AB7" }}>
          No sign-up · No credit card · No tracking · Open in seconds
        </p>
      </section>

      {/* ── Stats bar ──────────────────────────────────────── */}
      <section style={{
        borderTop: "1px solid rgba(175,169,236,0.08)",
        borderBottom: "1px solid rgba(175,169,236,0.08)",
        background: "rgba(83,74,183,0.06)",
        padding: "40px 2rem",
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
              <div style={{ fontSize: "2.4rem", fontWeight: 800, color: "#534AB7", lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: "12px", color: "#7f77dd", marginTop: "8px", lineHeight: 1.5 }}>{s.label}</div>
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
          color: "#f0effe",
          marginBottom: "12px",
        }}>
          Everything your finances need
        </h2>
        <p style={{ textAlign: "center", color: "#7f77dd", marginBottom: "48px", fontSize: "1rem" }}>
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
                background: "rgba(44,41,68,0.5)",
                border: "1px solid rgba(175,169,236,0.12)",
                borderRadius: "16px",
                padding: "28px",
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: "10px",
                background: "rgba(83,74,183,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: "16px",
                color: "#AFA9EC",
              }}>
                <Icon size={20} />
              </div>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#f0effe", marginBottom: "8px" }}>{title}</h3>
              <p style={{ fontSize: "14px", color: "#7f77dd", lineHeight: 1.65, margin: 0 }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Origin story / brand ───────────────────────────── */}
      <section style={{
        background: "rgba(83,74,183,0.08)",
        borderTop: "1px solid rgba(175,169,236,0.08)",
        borderBottom: "1px solid rgba(175,169,236,0.08)",
        padding: "80px 2rem",
      }}>
        <div style={{ maxWidth: "620px", margin: "0 auto", textAlign: "center" }}>
          <div style={{
            fontSize: "3rem",
            marginBottom: "16px",
          }}>📖</div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#f0effe", marginBottom: "20px" }}>
            Named for the father of accounting
          </h2>
          <p style={{ color: "#7f77dd", lineHeight: 1.8, fontSize: "1rem" }}>
            Luca Pacioli published <em style={{ color: "#AFA9EC" }}>Summa de Arithmetica</em> in 1494 — codifying double-entry bookkeeping
            and laying the foundation for modern finance. His insight: every transaction has two sides.
            Assets and liabilities. Income and spending. Where you are and where you're headed.
          </p>
          <p style={{ color: "#7f77dd", lineHeight: 1.8, fontSize: "1rem", marginTop: "16px" }}>
            Pacioli brings that rigour to your household — not corporate-grade complexity, just the
            clarity of knowing exactly where every dollar comes from and where it goes.
          </p>
          <p style={{ marginTop: "24px", fontSize: "13px", color: "#534AB7", fontStyle: "italic" }}>
            pah · CHOH · lee
          </p>
        </div>
      </section>

      {/* ── Bottom CTA ─────────────────────────────────────── */}
      <section style={{ textAlign: "center", padding: "80px 2rem 100px" }}>
        <h2 style={{ fontSize: "2rem", fontWeight: 700, color: "#f0effe", marginBottom: "12px" }}>
          Ready to see your real picture?
        </h2>
        <p style={{ color: "#7f77dd", marginBottom: "40px", fontSize: "1rem" }}>
          Takes 2 minutes. No account required.
        </p>
        <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/setup"
            style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              background: "#534AB7",
              color: "#fff",
              padding: "14px 28px",
              borderRadius: "12px",
              fontWeight: 700,
              fontSize: "1rem",
              textDecoration: "none",
              boxShadow: "0 0 40px rgba(83,74,183,0.35)",
            }}
          >
            Get started <ArrowRight size={16} />
          </Link>
          <button
            onClick={handleTryDemo}
            style={{
              background: "transparent",
              border: "1px solid rgba(175,169,236,0.2)",
              color: "#7f77dd",
              padding: "14px 28px",
              borderRadius: "12px",
              fontSize: "1rem",
              cursor: "pointer",
            }}
          >
            Try sandbox first
          </button>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer style={{
        borderTop: "1px solid rgba(175,169,236,0.08)",
        padding: "24px 2rem",
        textAlign: "center",
        fontSize: "12px",
        color: "#534AB7",
      }}>
        Built by{" "}
        <a href="https://aiopsoctopus.substack.com" target="_blank" rel="noopener noreferrer" style={{ color: "#7f77dd", textDecoration: "none" }}>
          Christina Moore
        </a>
        {" · "}
        <a href="https://aiopsoctopus.substack.com" target="_blank" rel="noopener noreferrer" style={{ color: "#7f77dd", textDecoration: "none" }}>
          The AI Ops Octopus
        </a>
        {" "}🐙
      </footer>
    </div>
  );
}
