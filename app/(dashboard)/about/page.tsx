"use client";
import Link from "next/link";
import {
  BookOpen, Shield, Upload, Tag, Wallet, TrendingUp,
  ExternalLink, Heart,
} from "lucide-react";

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div className="pacioli-bg-surface rounded-2xl p-8 border space-y-4">
      {children}
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-2">
      <span className="pacioli-accent">{icon}</span>
      <h2 className="text-lg font-bold pacioli-text-primary">{children}</h2>
    </div>
  );
}

function Step({ n, label, sub, href }: { n: number; label: string; sub: string; href: string }) {
  return (
    <Link href={href} className="flex items-start gap-4 p-4 rounded-xl border pacioli-border-subtle hover:border-teal-600/40 transition-colors group">
      <span className="w-7 h-7 rounded-full bg-teal-700/20 border border-teal-500/30 pacioli-accent text-sm font-bold flex items-center justify-center shrink-0 mt-0.5">
        {n}
      </span>
      <div>
        <p className="text-sm font-semibold pacioli-text-primary group-hover:pacioli-accent transition-colors">{label}</p>
        <p className="text-xs pacioli-text-muted mt-0.5">{sub}</p>
      </div>
    </Link>
  );
}

export default function AboutPage() {
  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div>
        <p className="pacioli-text-muted text-sm">The story behind the app</p>
        <h1 className="text-3xl font-bold pacioli-text-primary mt-1">About Pacioli</h1>
      </div>

      {/* What it is + pronunciation */}
      <Section>
        <SectionTitle icon={<BookOpen size={18} />}>What is Pacioli?</SectionTitle>
        <p className="text-sm pacioli-text-secondary leading-relaxed">
          Pacioli (pronounced <span className="font-semibold pacioli-text-primary">pah-CHOH-lee</span>) is a household
          financial operating system I built for myself — a single place to see my net worth, track spending,
          manage a budget, plan for goals, and project where things are heading.
        </p>
        <p className="text-sm pacioli-text-secondary leading-relaxed">
          It's named after Luca Pacioli, the 15th-century mathematician who first wrote down the principles
          of double-entry bookkeeping — the same idea that every dollar has two sides.
        </p>
        <p className="text-sm pacioli-text-secondary leading-relaxed">
          I got tired of financial apps that either required handing over bank credentials to a third party,
          charged a monthly subscription for features I didn't use, or buried the numbers I actually cared about
          behind opinionated dashboards. So I built this instead.
        </p>
      </Section>

      {/* Privacy */}
      <Section>
        <SectionTitle icon={<Shield size={18} />}>Privacy, clearly explained</SectionTitle>
        <p className="text-sm pacioli-text-secondary leading-relaxed">
          Pacioli gives you two ways to get your data in, with different privacy tradeoffs — and I want to
          be upfront about both.
        </p>
        <div className="space-y-3">
          <div className="p-4 pacioli-bg-surface-2 border pacioli-border rounded-xl space-y-1">
            <p className="text-sm font-semibold pacioli-text-primary">CSV import — fully local</p>
            <p className="text-xs pacioli-text-secondary leading-relaxed">
              Export a CSV from your bank and drop it in. Your transaction data is stored in your browser's
              local storage and <span className="font-medium pacioli-text-primary">never leaves your device</span>.
              No server, no database, no telemetry. You can verify this in DevTools → Network — zero outbound
              requests carry your data.
            </p>
          </div>
          <div className="p-4 pacioli-bg-surface-2 border pacioli-border rounded-xl space-y-1">
            <p className="text-sm font-semibold pacioli-text-primary">Plaid live connection — optional, disclosed</p>
            <p className="text-xs pacioli-text-secondary leading-relaxed">
              Connecting a live bank via Plaid is faster and stays up to date automatically — but it routes
              your bank credentials and transaction history through Plaid's infrastructure. That's a real
              tradeoff. It's opt-in, clearly labeled, and you can use CSV import instead if you'd rather keep
              everything local. See <a href="https://plaid.com/legal/privacy-statement/" target="_blank" rel="noopener noreferrer" className="pacioli-accent underline">Plaid's privacy policy</a>.
            </p>
          </div>
        </div>
        <p className="text-xs pacioli-text-muted leading-relaxed">
          Your account (used to sign in) is managed by <a href="https://clerk.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="pacioli-accent underline">Clerk</a>.
          No financial data is stored there — only your email address for authentication.
          There is no telemetry, no ad tracking, and no analytics on your usage.
        </p>
      </Section>

      {/* Who built it */}
      <Section>
        <SectionTitle icon={<Heart size={18} />}>Who built this</SectionTitle>
        <p className="text-sm pacioli-text-secondary leading-relaxed">
          I'm <span className="font-semibold pacioli-text-primary">Christina Moore</span>. I built Pacioli
          because I wanted a financial dashboard that worked exactly the way I think about money — organized
          around net worth, cash flow, goals, and long-term trajectory — without compromising on privacy or
          paying for a subscription.
        </p>
        <p className="text-sm pacioli-text-secondary leading-relaxed">
          I write about AI, automation, and tools like this one at{" "}
          <a
            href="https://aiopsoctopus.substack.com"
            target="_blank"
            rel="noopener noreferrer"
            className="pacioli-accent hover:opacity-80 transition-colors inline-flex items-center gap-1"
          >
            The AI Ops Octopus <ExternalLink size={11} />
          </a>
          {" "}on Substack.
        </p>
        <p className="text-sm pacioli-text-secondary leading-relaxed">
          I built Pacioli with{" "}
          <a
            href="https://claude.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="pacioli-accent hover:opacity-80 transition-colors inline-flex items-center gap-1"
          >
            Claude <ExternalLink size={11} />
          </a>
          {" "}— Anthropic's AI — using Next.js, TypeScript, and Tailwind CSS. The whole thing is deployed
          for free on Vercel and the source lives in a private GitHub repo.
        </p>
      </Section>

      {/* Getting started */}
      <Section>
        <SectionTitle icon={<Upload size={18} />}>Recommended first steps</SectionTitle>
        <p className="text-sm pacioli-text-secondary mb-2">
          Here's the quickest path to seeing your real numbers:
        </p>
        <div className="space-y-2">
          <Step
            n={1}
            label="Connect your data"
            sub="Upload a CSV from your bank, or connect a live bank account via Plaid on the Connect page."
            href="/connect"
          />
          <Step
            n={2}
            label="Review uncategorized transactions"
            sub="After importing, the app will guide you to any transactions it couldn't categorize."
            href="/transactions"
          />
          <Step
            n={3}
            label="Set your category rules"
            sub="Teach the app to auto-categorize recurring merchants so future imports need less cleanup."
            href="/cash-flow"
          />
          <Step
            n={4}
            label="Run the budget setup"
            sub="Pacioli analyses your last 6 months and suggests a monthly target for each category."
            href="/budget"
          />
          <Step
            n={5}
            label="Check the forecast"
            sub="See a 12-month net worth projection based on your actual income and spending averages."
            href="/forecast"
          />
        </div>
      </Section>

      {/* Quick links */}
      <div className="flex gap-3 flex-wrap text-xs pacioli-text-muted">
        <Link href="/" className="hover:pacioli-text-primary transition-colors">← Back to dashboard</Link>
        <span>·</span>
        <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:pacioli-text-primary transition-colors inline-flex items-center gap-1">Source code <ExternalLink size={10} /></a>
        <span>·</span>
        <a href="https://pacioli-aiopsoctopus.vercel.app" target="_blank" rel="noopener noreferrer" className="hover:pacioli-text-primary transition-colors inline-flex items-center gap-1">Live app <ExternalLink size={10} /></a>
      </div>
    </div>
  );
}
