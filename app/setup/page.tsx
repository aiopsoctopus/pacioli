"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Upload, Layers, CheckCircle2, ChevronLeft } from "lucide-react";
import PacioliLogo from "@/components/pacioli-logo";

const SETUP_COMPLETE_KEY = "pacioli-setup-complete";
const DEMO_STORAGE_KEY   = "pacioli-demo-mode";

type Step = "welcome" | "choose" | "sandbox-ready" | "import-hint";

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [name, setName] = useState("");

  // ── Sandbox path ────────────────────────────────────────────────────────────
  function enterSandbox() {
    localStorage.setItem(DEMO_STORAGE_KEY, "true");
    localStorage.setItem(SETUP_COMPLETE_KEY, "demo");
    // Navigate to dashboard with demo flag
    router.push("/zoom-out?demo=true");
  }

  // ── Real data path ───────────────────────────────────────────────────────────
  function finishSetup() {
    localStorage.setItem(SETUP_COMPLETE_KEY, "true");
    localStorage.removeItem(DEMO_STORAGE_KEY);
    router.push("/zoom-out");
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0e0c1e",
      color: "#f0effe",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Top bar */}
      <header style={{
        padding: "20px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid rgba(175,169,236,0.08)",
      }}>
        <PacioliLogo size={28} variant="wordmark" theme="dark" />
        {step !== "welcome" && (
          <button
            onClick={() => setStep("welcome")}
            style={{
              background: "transparent",
              border: "none",
              color: "#7f77dd",
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
              <div style={{ marginBottom: "32px" }}>
                <PacioliLogo size={56} variant="mark" theme="dark" />
              </div>
              <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "12px", letterSpacing: "-0.02em" }}>
                Welcome to Pacioli
              </h1>
              <p style={{ color: "#7f77dd", fontSize: "1.05rem", lineHeight: 1.7, marginBottom: "40px" }}>
                Let's get your financial picture set up.<br />
                It takes about 2 minutes.
              </p>

              <div style={{ marginBottom: "32px", textAlign: "left" }}>
                <label style={{ display: "block", fontSize: "13px", color: "#AFA9EC", marginBottom: "8px", fontWeight: 600 }}>
                  What should we call you? <span style={{ color: "#534AB7", fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Christina"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && setStep("choose")}
                  style={{
                    width: "100%",
                    background: "rgba(44,41,68,0.7)",
                    border: "1px solid rgba(175,169,236,0.2)",
                    borderRadius: "10px",
                    color: "#f0effe",
                    fontSize: "1rem",
                    padding: "12px 16px",
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "border-color 0.15s",
                  }}
                  onFocus={e => (e.target.style.borderColor = "#534AB7")}
                  onBlur={e => (e.target.style.borderColor = "rgba(175,169,236,0.2)")}
                />
              </div>

              <button
                onClick={() => setStep("choose")}
                style={{
                  width: "100%",
                  background: "#534AB7",
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
                  boxShadow: "0 0 32px rgba(83,74,183,0.3)",
                }}
              >
                Continue <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* ── Step: choose path ── */}
          {step === "choose" && (
            <div>
              <h2 style={{ fontSize: "1.6rem", fontWeight: 800, marginBottom: "8px", textAlign: "center" }}>
                {name ? `Hi ${name} 👋` : "How do you want to start?"}
              </h2>
              {name && (
                <p style={{ textAlign: "center", color: "#7f77dd", marginBottom: "8px" }}>How do you want to start?</p>
              )}
              <p style={{ textAlign: "center", color: "#534AB7", fontSize: "13px", marginBottom: "36px" }}>
                You can switch at any time
              </p>

              {/* Real data card */}
              <button
                onClick={() => setStep("import-hint")}
                style={{
                  width: "100%",
                  background: "rgba(44,41,68,0.5)",
                  border: "1px solid rgba(83,74,183,0.4)",
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
                  e.currentTarget.style.borderColor = "#534AB7";
                  e.currentTarget.style.background = "rgba(83,74,183,0.12)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = "rgba(83,74,183,0.4)";
                  e.currentTarget.style.background = "rgba(44,41,68,0.5)";
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: "10px",
                  background: "rgba(83,74,183,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, color: "#AFA9EC",
                }}>
                  <Upload size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "6px", color: "#f0effe" }}>
                    Use my real data
                    <span style={{
                      marginLeft: "10px", fontSize: "11px", fontWeight: 600,
                      background: "rgba(29,158,117,0.2)", color: "#5dcaa5",
                      border: "1px solid rgba(29,158,117,0.3)",
                      borderRadius: "999px", padding: "2px 8px",
                    }}>Recommended</span>
                  </div>
                  <p style={{ color: "#7f77dd", fontSize: "14px", lineHeight: 1.6, margin: 0 }}>
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
                  background: "rgba(44,41,68,0.5)",
                  border: "1px solid rgba(175,169,236,0.15)",
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
                  e.currentTarget.style.borderColor = "#534AB7";
                  e.currentTarget.style.background = "rgba(83,74,183,0.1)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = "rgba(175,169,236,0.15)";
                  e.currentTarget.style.background = "rgba(44,41,68,0.5)";
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: "10px",
                  background: "rgba(83,74,183,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, color: "#7f77dd",
                }}>
                  <Layers size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "6px", color: "#f0effe" }}>
                    Explore with sandbox data
                  </div>
                  <p style={{ color: "#7f77dd", fontSize: "14px", lineHeight: 1.6, margin: 0 }}>
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
                background: "rgba(83,74,183,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 28px",
                color: "#AFA9EC",
              }}>
                <Layers size={28} />
              </div>
              <h2 style={{ fontSize: "1.6rem", fontWeight: 800, marginBottom: "12px" }}>
                Sandbox mode — ready to go
              </h2>
              <p style={{ color: "#7f77dd", lineHeight: 1.7, marginBottom: "12px", fontSize: "1rem" }}>
                You'll be exploring with sample data. Everything is interactive —
                budget, goals, forecast, transactions — but none of it is real.
              </p>
              <p style={{ color: "#534AB7", fontSize: "13px", marginBottom: "40px" }}>
                A yellow banner will remind you you're in sandbox mode.<br />
                Switch to your real data anytime via Settings.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <button
                  onClick={enterSandbox}
                  style={{
                    background: "#534AB7",
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
                    boxShadow: "0 0 32px rgba(83,74,183,0.3)",
                  }}
                >
                  Enter sandbox <ArrowRight size={16} />
                </button>
                <button
                  onClick={() => setStep("choose")}
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(175,169,236,0.15)",
                    borderRadius: "12px",
                    color: "#7f77dd",
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
                background: "rgba(83,74,183,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 28px",
                color: "#AFA9EC",
              }}>
                <Upload size={28} />
              </div>
              <h2 style={{ fontSize: "1.6rem", fontWeight: 800, marginBottom: "12px", textAlign: "center" }}>
                How to export your bank CSV
              </h2>
              <p style={{ color: "#7f77dd", textAlign: "center", marginBottom: "32px", fontSize: "14px", lineHeight: 1.7 }}>
                Most banks let you download a CSV under <strong style={{ color: "#AFA9EC" }}>Accounts → Download Transactions</strong>.
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
                    background: "rgba(44,41,68,0.5)",
                    border: "1px solid rgba(175,169,236,0.1)",
                    borderRadius: "10px",
                    padding: "12px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    flexWrap: "wrap",
                  }}>
                    <span style={{ fontWeight: 600, fontSize: "14px", color: "#f0effe", flexShrink: 0 }}>{bank}</span>
                    <span style={{ color: "#7f77dd", fontSize: "12px" }}>{path}</span>
                  </div>
                ))}
              </div>

              <p style={{ color: "#534AB7", fontSize: "13px", textAlign: "center", marginBottom: "28px" }}>
                Pacioli accepts any CSV with date, description/merchant, and amount columns.
                It'll figure out the rest.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <button
                  onClick={finishSetup}
                  style={{
                    background: "#534AB7",
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
                    boxShadow: "0 0 32px rgba(83,74,183,0.3)",
                  }}
                >
                  I've got my CSV — open Pacioli <ArrowRight size={16} />
                </button>
                <button
                  onClick={() => setStep("choose")}
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(175,169,236,0.15)",
                    borderRadius: "12px",
                    color: "#7f77dd",
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
      <div style={{
        padding: "24px",
        display: "flex",
        justifyContent: "center",
        gap: "8px",
      }}>
        {(["welcome", "choose", "sandbox-ready"] as Step[]).map((s, i) => {
          const steps: Step[] = ["welcome", "choose", "sandbox-ready"];
          const active = steps.indexOf(step) >= i;
          return (
            <div key={s} style={{
              width: active ? "20px" : "6px",
              height: "6px",
              borderRadius: "999px",
              background: active ? "#534AB7" : "rgba(83,74,183,0.25)",
              transition: "all 0.2s",
            }} />
          );
        })}
      </div>
    </div>
  );
}
