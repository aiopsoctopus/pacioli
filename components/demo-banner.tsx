"use client";
import { useDemo } from "@/components/demo-provider";
import { FlaskConical, X, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function DemoBanner() {
  const { isDemo, exitDemo } = useDemo();
  if (!isDemo) return null;

  return (
    <div className="w-full bg-teal-700 text-white px-4 py-2.5 flex items-center justify-between gap-4 text-sm shrink-0">
      <div className="flex items-center gap-2.5">
        <FlaskConical size={15} className="shrink-0 opacity-80" />
        <span className="font-medium">You're exploring with sample data.</span>
        <span className="opacity-80 hidden sm:inline">
          All figures are fictional — nothing here is connected to a real account.
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Link
          href="/connect"
          className="flex items-center gap-1 text-xs font-semibold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors"
        >
          Use my own data <ArrowRight size={12} />
        </Link>
        <button
          onClick={exitDemo}
          className="p-1 opacity-70 hover:opacity-100 transition-opacity"
          title="Exit demo mode"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
