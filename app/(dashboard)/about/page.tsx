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
        <SectionTitle icon={<Shield size={18} />}>Your data never leaves your device</SectionTitle>
        <p className="text-sm pacioli-text-secondary leading-relaxed">
          This is the thing I'm most deliberate about. Pacioli has no backend, no database, no user accounts,
          and no telemetry. Your financial data — CSV imports, category rules, budget amounts, everything you
          add or change — is written to your browser's local storage and never sent anywhere.
        </p>
        <p className="text-sm pacioli-text-secondary leading-relaxed">
          I know "local storage" can sound technical, so here's the clearest way I can put it: the app code
          is hosted on Vercel and loads in your browser like any website. But there's a meaningful difference
          between the <span className="font-medium pacioli-text-primary">code</span> (which downloads once, like a webpage)
          and your <span className="font-medium pacioli-text-primary">data</span> (which never goes back up).
          Think of it like downloading a spreadsheet template — the template came from the internet, but your
          numbers stay on your computer. Pacioli works the same way.
        </p>
        <div className="p-4 pacioli-bg-surface-2 border pacioli-border rounded-xl">
          <p className="text-xs pacioli-text-secondary leading-relaxed">
            <span className="font-semibold pacioli-accent">You can verify this yourself.</span> Open
            DevTools → Network tab, then import a CSV. You'll see zero outbound requests carrying your data —
            because none are made. Compare that to apps like Mint, YNAB, or Copilot, which store your
            transaction history and spending patterns on their servers. That's a real tradeoff. Pacioli
            makes the opposite choice.
          </p>
        </div>
        <p className="text-xs pacioli-text-muted leading-relaxed">
          <span className="font-medium pacioli-text-secondary">A note on Plaid:</span> A future version of Pacioli
          will optionally support live bank connections via Plaid. That will change this story — Plaid
          connects to your accounts through their servers. I'll make that tradeoff explicit and opt-in when
          the time comes. For now, everything stays local.
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
          The app comes pre-loaded with sample data so every page works out of the box. When you're ready
          to use your real numbers, here's the workflow:
        </p>
        <div className="space-y-2">
          <Step
            n={1}
            label="Import your transactions"
            sub="Export a CSV from your bank and upload it on the Connect page."
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
