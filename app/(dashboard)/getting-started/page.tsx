"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Sparkles, ArrowRight, ExternalLink } from "lucide-react";

export const ONBOARDING_KEY = "pacioli-onboarded";

interface StepDef {
  id: string;
  label: string;
  description: string;
  href: string;
  cta: string;
  detail: string;
}

export const STEPS: StepDef[] = [
  {
    id: "import",
    label: "Import your transactions",
    description: "Replace the sample data with your real numbers.",
    detail:
      "Export a CSV from your bank's website (usually under Accounts → Download Transactions). Most major banks support this — Chase, Bank of America, Fidelity, and credit unions all offer CSV exports. Then upload it on the Connect page. Pacioli normalises the columns automatically.",
    href: "/connect",
    cta: "Go to Connect",
  },
  {
    id: "review",
    label: "Review uncategorized transactions",
    description: "Make sure every transaction has a category.",
    detail:
      "After importing, some transactions may land in Uncategorized because the merchant name didn't match any rule. Head to the Transactions page, filter by Uncategorized, and assign categories. You can also set a rule so the same merchant auto-categorizes on future imports.",
    href: "/transactions",
    cta: "Go to Transactions",
  },
  {
    id: "budget",
    label: "Set up your budget",
    description: "Let the AI suggest monthly targets based on your real spending.",
    detail:
      "The budget setup flow analyses your last 6 months of transactions per category and recommends a monthly target — accounting for trends, seasonal spikes, and a small buffer. You can accept, adjust, or skip any suggestion. Takes about 2 minutes.",
    href: "/budget",
    cta: "Go to Budget",
  },
  {
    id: "forecast",
    label: "Check your forecast",
    description: "See where you're headed over the next 12 months.",
    detail:
      "The forecast page calculates a 12-month net worth projection from your actual income and spending averages — not hardcoded assumptions. Try the scenario slider to see how an extra $200/month in savings changes the picture.",
    href: "/forecast",
    cta: "Go to Forecast",
  },
];

function loadOnboardingState(): { dismissed: boolean; completed: string[] } {
  if (typeof window === "undefined") return { dismissed: false, completed: [] };
  try {
    return JSON.parse(localStorage.getItem(ONBOARDING_KEY) ?? "null") ?? { dismissed: false, completed: [] };
  } catch {
    return { dismissed: false, completed: [] };
  }
}

function saveOnboardingState(state: { dismissed: boolean; completed: string[] }) {
  localStorage.setItem(ONBOARDING_KEY, JSON.stringify(state));
}

export default function GettingStartedPage() {
  const [mounted, setMounted] = useState(false);
  const [completed, setCompleted] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const s = loadOnboardingState();
    setCompleted(s.completed);
    setDismissed(s.dismissed);
    setMounted(true);
  }, []);

  function toggleComplete(id: string) {
    const next = completed.includes(id)
      ? completed.filter((c) => c !== id)
      : [...completed, id];
    setCompleted(next);
    saveOnboardingState({ dismissed, completed: next });
  }

  function markAllDone() {
    const all = STEPS.map((s) => s.id);
    setCompleted(all);
    setDismissed(true);
    saveOnboardingState({ dismissed: true, completed: all });
  }

  const doneCount = STEPS.filter((s) => completed.includes(s.id)).length;
  const allDone = doneCount === STEPS.length;

  if (!mounted) return null;

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div>
        <p className="pacioli-text-muted text-sm">You're almost ready to use real data</p>
        <h1 className="text-3xl font-bold pacioli-text-primary mt-1">Getting Started</h1>
      </div>

      {/* Progress bar */}
      <div className="pacioli-bg-surface rounded-2xl p-6 border">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold pacioli-text-primary">
            {allDone ? "All done! 🎉" : `${doneCount} of ${STEPS.length} steps complete`}
          </p>
          {allDone && (
            <button
              onClick={markAllDone}
              className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Dismiss this page →
            </button>
          )}
        </div>
        <div className="w-full h-2 pacioli-bar-track rounded-full overflow-hidden">
          <div
            className="h-2 rounded-full bg-indigo-500 transition-all duration-500"
            style={{ width: `${(doneCount / STEPS.length) * 100}%` }}
          />
        </div>
        {!allDone && (
          <p className="text-xs pacioli-text-muted mt-3">
            The app works fine with the sample data pre-loaded — these steps switch it over to your real numbers.
          </p>
        )}
      </div>

      {/* Step cards */}
      <div className="space-y-3">
        {STEPS.map((step, i) => {
          const done = completed.includes(step.id);
          return (
            <div
              key={step.id}
              className={`pacioli-bg-surface rounded-2xl border p-6 transition-opacity ${done ? "opacity-60" : ""}`}
            >
              <div className="flex items-start gap-4">
                {/* Step number / check */}
                <button
                  onClick={() => toggleComplete(step.id)}
                  className={`mt-0.5 shrink-0 transition-colors ${done ? "text-indigo-400" : "pacioli-text-muted hover:text-indigo-400"}`}
                  title={done ? "Mark incomplete" : "Mark complete"}
                >
                  {done
                    ? <CheckCircle2 size={22} />
                    : <Circle size={22} />}
                </button>

                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold pacioli-text-muted uppercase tracking-wide">Step {i + 1}</span>
                  </div>
                  <p className={`text-base font-bold ${done ? "line-through pacioli-text-muted" : "pacioli-text-primary"}`}>
                    {step.label}
                  </p>
                  {!done && (
                    <>
                      <p className="text-sm pacioli-text-secondary leading-relaxed">{step.detail}</p>
                      <Link
                        href={step.href}
                        className="inline-flex items-center gap-1.5 mt-1 text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        {step.cta} <ArrowRight size={14} />
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="flex items-start gap-3 p-4 bg-indigo-950/20 border border-indigo-800/20 rounded-xl">
        <Sparkles size={14} className="text-indigo-400 mt-0.5 shrink-0" />
        <p className="text-xs pacioli-text-secondary leading-relaxed">
          All your data stays on your device — no accounts, no servers, no telemetry.{" "}
          <Link href="/about" className="text-indigo-400 hover:text-indigo-300 transition-colors">
            Learn more about how Pacioli handles your data →
          </Link>
        </p>
      </div>

      {!allDone && (
        <p className="text-center text-xs pacioli-text-faint">
          <button
            onClick={markAllDone}
            className="hover:pacioli-text-muted transition-colors underline underline-offset-2"
          >
            Skip setup — I'll use the sample data
          </button>
        </p>
      )}
    </div>
  );
}
