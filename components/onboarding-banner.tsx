"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, X, Sparkles } from "lucide-react";

const STORAGE_KEY = "pacioli-onboarded";

interface StepDef {
  id: string;
  label: string;
  description: string;
  href: string;
  cta: string;
}

const STEPS: StepDef[] = [
  {
    id: "import",
    label: "Import your transactions",
    description: "Export a CSV from your bank and upload it on the Connect page to replace the sample data with your real numbers.",
    href: "/connect",
    cta: "Go to Connect →",
  },
  {
    id: "review",
    label: "Review uncategorized transactions",
    description: "After importing, check the Transactions page for anything that needs a category assigned.",
    href: "/transactions",
    cta: "Go to Transactions →",
  },
  {
    id: "budget",
    label: "Set up your budget",
    description: "Pacioli analyses your last 6 months of spending and suggests a monthly target for each category. Takes about 2 minutes.",
    href: "/budget",
    cta: "Go to Budget →",
  },
  {
    id: "forecast",
    label: "Check your forecast",
    description: "See a 12-month net worth projection based on your actual income and spending averages — and run scenarios.",
    href: "/forecast",
    cta: "Go to Forecast →",
  },
];

function loadState(): { dismissed: boolean; completed: string[] } {
  if (typeof window === "undefined") return { dismissed: false, completed: [] };
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") ?? { dismissed: false, completed: [] };
  } catch {
    return { dismissed: false, completed: [] };
  }
}

function saveState(state: { dismissed: boolean; completed: string[] }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export default function OnboardingBanner() {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [completed, setCompleted] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const s = loadState();
    setDismissed(s.dismissed);
    setCompleted(s.completed);
    setMounted(true);
  }, []);

  // Don't render until we've read localStorage (avoids flash)
  if (!mounted) return null;
  // Fully dismissed — never show again
  if (dismissed) return null;
  // All steps done — auto-dismiss after a short delay
  const allDone = STEPS.every((s) => completed.includes(s.id));

  function toggleComplete(id: string) {
    const next = completed.includes(id)
      ? completed.filter((c) => c !== id)
      : [...completed, id];
    setCompleted(next);
    saveState({ dismissed, completed: next });
  }

  function dismiss() {
    setDismissed(true);
    saveState({ dismissed: true, completed });
  }

  const doneCount = STEPS.filter((s) => completed.includes(s.id)).length;

  return (
    <div className="mx-8 mt-6 mb-2 pacioli-bg-surface border rounded-2xl overflow-hidden">
      {/* Header bar */}
      <div
        className="flex items-center gap-3 px-5 py-3.5 cursor-pointer select-none"
        onClick={() => setExpanded((e) => !e)}
      >
        <Sparkles size={15} className="text-indigo-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold pacioli-text-primary">
            {allDone ? "You're all set! 🎉" : "Get started with Pacioli"}
          </p>
          <p className="text-xs pacioli-text-muted">
            {allDone
              ? "All setup steps complete — feel free to dismiss this."
              : `${doneCount} of ${STEPS.length} steps complete`}
          </p>
        </div>

        {/* Progress pip row */}
        <div className="flex gap-1 shrink-0">
          {STEPS.map((s) => (
            <span
              key={s.id}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                completed.includes(s.id) ? "bg-indigo-400" : "bg-zinc-600"
              }`}
            />
          ))}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); dismiss(); }}
          className="p-1 pacioli-text-muted hover:pacioli-text-primary transition-colors shrink-0"
          title="Dismiss"
        >
          <X size={14} />
        </button>
        <span className="pacioli-text-muted shrink-0">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </div>

      {/* Steps */}
      {expanded && (
        <div className="border-t pacioli-border-subtle divide-y pacioli-border-subtle">
          {STEPS.map((step) => {
            const done = completed.includes(step.id);
            return (
              <div key={step.id} className={`flex items-start gap-4 px-5 py-4 transition-colors ${done ? "opacity-60" : ""}`}>
                {/* Checkbox */}
                <button
                  onClick={() => toggleComplete(step.id)}
                  className={`mt-0.5 shrink-0 transition-colors ${done ? "text-indigo-400" : "pacioli-text-muted hover:text-indigo-400"}`}
                  title={done ? "Mark incomplete" : "Mark complete"}
                >
                  {done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${done ? "line-through pacioli-text-muted" : "pacioli-text-primary"}`}>
                    {step.label}
                  </p>
                  {!done && (
                    <p className="text-xs pacioli-text-muted mt-0.5 leading-relaxed">{step.description}</p>
                  )}
                </div>

                {/* CTA */}
                {!done && (
                  <Link
                    href={step.href}
                    className="shrink-0 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors whitespace-nowrap mt-0.5"
                  >
                    {step.cta}
                  </Link>
                )}
              </div>
            );
          })}

          {/* Footer */}
          <div className="px-5 py-3 flex items-center justify-between">
            <Link href="/about" className="text-xs pacioli-text-muted hover:pacioli-text-primary transition-colors">
              Learn more about Pacioli →
            </Link>
            <button
              onClick={dismiss}
              className="text-xs pacioli-text-faint hover:pacioli-text-muted transition-colors"
            >
              Dismiss forever
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
