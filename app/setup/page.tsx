"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Upload, Layers, ChevronLeft } from "lucide-react";
import PacioliLogo from "@/components/pacioli-logo";

const SETUP_COMPLETE_KEY = "pacioli-setup-complete";
const DEMO_STORAGE_KEY   = "pacioli-demo-mode";

type Step = "welcome" | "choose" | "sandbox-ready" | "import-hint";

/* ── Warm Stone palette (matches landing page) ── */
const C = {
  pageBg:         "#faf8f4",
  headerBorder:   "#e5dfd6",
  textPrimary:    "#1e1a14",
  textSecondary:  "#78705e",
  textMuted:      "#a89f8e",
  inputBg:        "#ffffff",
  inputBorder:    "#d6cfc4",
  inputFocus:     "#0d6e6e",
  cardBg:         "#ffffff",
  cardBorder:     "#e5dfd6",
  cardHoverBorder:"#0d6e6e",
  cardHoverBg:    "rgba(13,110,110,0.04)",
  iconBg:         "#e0f4f4",
  iconColor:      "#0d6e6e",
  iconBgMuted:    "#f0f0ed",
  ctaPrimary:     "#0d6e6e",
  ctaSecBorder:   "#d6cfc4",
  ctaSecText:     "#78705e",
  badgeBg:        "rgba(13,110,110,0.12)",
  badgeBorder:    "rgba(13,110,110,0.25)",
  badgeText:      "#0d6e6e",
  dotActive:      "#0d6e6e",
  dotInactive:    "#d6cfc4",
  bankRowBg:      "#f3f0ea",
  bankRowBorder:  "#e5dfd6",
};

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [name, setName] = useState("");

  function enterSandbox() {
    localStorage.setItem(DEMO_STORAGE_KEY, "true");
    localStorage.setItem(SETUP_COMPLETE_KEY, "demo");
    router.push("/zoom-out?demo=true");
  }

  function finishSetup() {
    localStorage.setItem(SETUP_COMPLETE_KEY, "true");
    localStorage.removeItem(DEMO_STORAGE_KEY);
    router.push("/zoom-out");
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: C.pageBg,
      color: C.textPrimary,
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Top bar */}
      <header style={{
        padding: "20px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: `1px solid ${C.headerBorder}`,
      }}>
        <PacioliLogo size={28} variant="wordmark" theme="light" />
        {step !== "welcome" && (
          <button
            onClick={() => setStep("welcome")}
            style={{
              background: "transparent",
              border: "none",
              color: C.textMuted,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "13px",
            }}
          >
            <ChevronLeft size={14} /> Back
          </button>
        )}
      </header>

      {/* Main content */}
      <main style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
      }}>
        <div style={{ width: "100%", maxWidth: "520px" }}>

          {/* ── Step: welcome ── */}
          {step === "welcome" && (
            <div style={{ textAlign: "center" }}>
              <div style={{ marginBottom: "32px", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
                <PacioliLogo size={56} variant="mark" theme="light" />
              </div>
              <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "12px", letterSpacing: "-0.02em", color: C.textPrimary }}>
                Welcome to Pacioli
              </h1>
              <p style={{ color: C.textSecondary, fontSize: "1.05rem", lineHeight: 1.7, marginBottom: "40px" }}>
                Let's get your financial picture set up.<br />
                It takes about 2 minutes.
              </p>

              <div style={{ marginBottom: "32px", textAlign: "left" }}>
                <label style={{ display: "block", fontSize: "13px", color: C.textMuted, marginBottom: "8px", fontWeight: 600 }}>
                  What should we call you? <span style={{ fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Christina"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && setStep("choose")}
                  style={{
                    width: "100%",
                    background: C.inputBg,
                    border: `1px solid ${C.inputBorder}`,
                    borderRadius: "10px",
                    color: C.textPrimary,
                    fontSize: "1rem",
                    padding: "12px 16px",
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "border-color 0.15s",
                  }}
                  onFocus={e => (e.target.style.borderColor = C.inputFocus)}
                  onBlur={e => (e.target.style.borderColor = C.inputBorder)}
                />
              </div>

              <button
                onClick={() => setStep("choose")}
                style={{
                  width: "100%",
                  background: C.ctaPrimary,
                  border: "none",
                  borderRadius: "12px",
                  color: "#fff",
                  fontSize: "1rem",
                  fontWeight: 700,
                  padding: "14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                Continue <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* ── Step: choose path ── */}
          {step === "choose" && (
            <div>
              <h2 style={{ fontSize: "1.6rem", fontWeight: 800, marginBottom: "8px", textAlign: "center", color: C.textPrimary }}>
                {name ? `Hi ${name} 👋` : "How do you want to start?"}
              </h2>
              {name && (
                <p style={{ textAlign: "center", color: C.textSecondary, marginBottom: "8px" }}>How do you want to start?</p>
              )}
              <p style={{ textAlign: "center", color: C.textMuted, fontSize: "13px", marginBottom: "36px" }}>
                You can switch at any time
              </p>

              {/* Real data card */}
              <button
                onClick={() => setStep("import-hint")}
                style={{
                  width: "100%",
                  background: C.cardBg,
                  border: `1px solid ${C.cardBorder}`,
                  borderRadius: "16px",
                  padding: "24px",
                  cursor: "pointer",
                  textAlign: "left",
                  marginBottom: "14px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "20px",
                  transition: "border-color 0.15s, background 0.15s",
                  color: "inherit",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = C.cardHoverBorder;
                  e.currentTarget.style.background = C.cardHoverBg;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = C.cardBorder;
                  e.currentTarget.style.background = C.cardBg;
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: "10px",
                  background: C.iconBg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, color: C.iconColor,
                }}>
                  <Upload size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "6px", color: C.textPrimary }}>
                    Use my real data
                    <span style={{
                      marginLeft: "10px", fontSize: "11px", fontWeight: 600,
                      background: C.badgeBg, color: C.badgeText,
                      border: `1px solid ${C.badgeBorder}`,
                      borderRadius: "999px", padding: "2px 8px",
                    }}>Recommended</span>
                  </div>
                  <p style={{ color: C.textSecondary, fontSize: "14px", lineHeight: 1.6, margin: 0 }}>
                    Import a CSV from your bank. Pacioli normalises the format automatically.
                    Your numbers stay on your device — always.
                  </p>
                </div>
              </button>

              {/* Sandbox card */}
              <button
                onClick={() => setStep("sandbox-ready")}
                style={{
                  width: "100%",
                  background: C.cardBg,
                  border: `1px solid ${C.cardBorder}`,
                  borderRadius: "16px",
                  padding: "24px",
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "20px",
                  transition: "border-color 0.15s, background 0.15s",
                  color: "inherit",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = C.cardHoverBorder;
                  e.currentTarget.style.background = C.cardHoverBg;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = C.cardBorder;
                  e.currentTarget.style.background = C.cardBg;
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: "10px",
                  background: C.iconBgMuted,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, color: C.iconColor,
                }}>
                  <Layers size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "6px", color: C.textPrimary }}>
                    Explore with sandbox data
                  </div>
                  <p style={{ color: C.textSecondary, fontSize: "14px", lineHeight: 1.6, margin: 0 }}>
                    Pre-loaded with sample transactions, a budget, and goals so you can
                    see exactly how Pacioli works before committing your own numbers.
                  </p>
                </div>
              </button>
            </div>
          )}

          {/* ── Step: sandbox ready ── */}
          {step === "sandbox-ready" && (
            <div style={{ textAlign: "center" }}>
              <div style={{
                width: 64, height: 64, borderRadius: "16px",
                background: C.iconBg,
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 28px",
                color: C.iconColor,
              }}>
                <Layers size={28} />
              </div>
              <h2 style={{ fontSize: "1.6rem", fontWeight: 800, marginBottom: "12px", color: C.textPrimary }}>
                Sandbox mode — ready to go
              </h2>
              <p style={{ color: C.textSecondary, lineHeight: 1.7, marginBottom: "12px", fontSize: "1rem" }}>
                You'll be exploring with sample data. Everything is interactive —
                budget, goals, forecast, transactions — but none of it is real.
              </p>
              <p style={{ color: C.textMuted, fontSize: "13px", marginBottom: "40px" }}>
                A yellow banner will remind you you're in sandbox mode.<br />
                Switch to your real data anytime via Settings.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <button
                  onClick={enterSandbox}
                  style={{
                    background: C.ctaPrimary,
                    border: "none",
                    borderRadius: "12px",
                    color: "#fff",
                    fontSize: "1rem",
                    fontWeight: 700,
                    padding: "14px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  Enter sandbox <ArrowRight size={16} />
                </button>
                <button
                  onClick={() => setStep("choose")}
                  style={{
                    background: "transparent",
                    border: `1px solid ${C.ctaSecBorder}`,
                    borderRadius: "12px",
                    color: C.ctaSecText,
                    fontSize: "14px",
                    padding: "12px",
                    cursor: "pointer",
                  }}
                >
                  ← Go back
                </button>
              </div>
            </div>
          )}

          {/* ── Step: import hint ── */}
          {step === "import-hint" && (
            <div>
              <div style={{
                width: 64, height: 64, borderRadius: "16px",
                background: C.iconBg,
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 28px",
                color: C.iconColor,
              }}>
                <Upload size={28} />
              </div>
              <h2 style={{ fontSize: "1.6rem", fontWeight: 800, marginBottom: "12px", textAlign: "center", color: C.textPrimary }}>
                How to export your bank CSV
              </h2>
              <p style={{ color: C.textSecondary, textAlign: "center", marginBottom: "32px", fontSize: "14px", lineHeight: 1.7 }}>
                Most banks let you download a CSV under <strong style={{ color: C.textPrimary }}>Accounts → Download Transactions</strong>.
                Here's where to find it for the major ones:
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "32px" }}>
                {[
                  { bank: "Chase", path: "Accounts → Download Account Activity → CSV" },
                  { bank: "Bank of America", path: "Accounts → Download → Microsoft Excel format" },
                  { bank: "Wells Fargo", path: "Accounts → Download Transactions → Comma-Separated Values" },
                  { bank: "Fidelity", path: "Activity & Orders → Download → CSV" },
                  { bank: "Most credit unions", path: "Accounts → Export Transactions → CSV" },
                ].map(({ bank, path }) => (
                  <div key={bank} style={{
                    background: C.bankRowBg,
                    border: `1px solid ${C.bankRowBorder}`,
                    borderRadius: "10px",
                    padding: "12px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    flexWrap: "wrap",
                  }}>
                    <span style={{ fontWeight: 600, fontSize: "14px", color: C.textPrimary, flexShrink: 0 }}>{bank}</span>
                    <span style={{ color: C.textSecondary, fontSize: "12px" }}>{path}</span>
                  </div>
                ))}
              </div>

              <p style={{ color: C.textMuted, fontSize: "13px", textAlign: "center", marginBottom: "28px" }}>
                Pacioli accepts any CSV with date, description/merchant, and amount columns.
                It'll figure out the rest.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <button
                  onClick={finishSetup}
                  style={{
                    background: C.ctaPrimary,
                    border: "none",
                    borderRadius: "12px",
                    color: "#fff",
                    fontSize: "1rem",
                    fontWeight: 700,
                    padding: "14px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  I've got my CSV — open Pacioli <ArrowRight size={16} />
                </button>
                <button
                  onClick={() => setStep("choose")}
                  style={{
                    background: "transparent",
                    border: `1px solid ${C.ctaSecBorder}`,
                    borderRadius: "12px",
                    color: C.ctaSecText,
                    fontSize: "14px",
                    padding: "12px",
                    cursor: "pointer",
                  }}
                >
                  ← Go back
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Progress dots */}
      <div style={{ padding: "24px", display: "flex", justifyContent: "center", gap: "8px" }}>
        {(["welcome", "choose", "sandbox-ready"] as Step[]).map((s, i) => {
          const steps: Step[] = ["welcome", "choose", "sandbox-ready"];
          const active = steps.indexOf(step) >= i;
          return (
            <div key={s} style={{
              width: active ? "20px" : "6px",
              height: "6px",
              borderRadius: "999px",
              background: active ? C.dotActive : C.dotInactive,
              transition: "all 0.2s",
            }} />
          );
        })}
      </div>
    </div>
  );
}
