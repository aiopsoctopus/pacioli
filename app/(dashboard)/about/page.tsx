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
      <span className="text-indigo-400">{icon}</span>
      <h2 className="text-lg font-bold pacioli-text-primary">{children}</h2>
    </div>
  );
}

function Step({ n, label, sub, href }: { n: number; label: string; sub: string; href: string }) {
  return (
    <Link href={href} className="flex items-start gap-4 p-4 rounded-xl border pacioli-border-subtle hover:border-indigo-500/40 transition-colors group">
      <span className="w-7 h-7 rounded-full bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 text-sm font-bold flex items-center justify-center shrink-0 mt-0.5">
        {n}
      </span>
      <div>
        <p className="text-sm font-semibold pacioli-text-primary group-hover:text-indigo-400 transition-colors">{label}</p>
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
          It's named after{" "}
          <span className="font-medium pacioli-text-primary">Luca Pacioli</span>, the 15th-century Italian
          mathematician who published the first systematic description of double-entry bookkeeping in 1494. He
          believed that a person couldn't truly understand their affairs without keeping their own accounts.
          I think that's still right.
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
          and no telemetry. When you import a CSV, it goes into <code className="text-xs bg-zinc-500/20 px-1.5 py-0.5 rounded font-mono pacioli-text-primary">localStorage</code> in
          your browser — on your device, nowhere else. The static account and transaction data that comes
          pre-loaded lives entirely in the app bundle.
        </p>
        <p className="text-sm pacioli-text-secondary leading-relaxed">
          Nobody can see your financial data because there is literally nowhere for it to go. There are no
          servers receiving it, no API calls phoning home, no analytics collecting it. You can verify this
          by opening DevTools → Network while using the app — you'll see no outbound requests to any external
          service.
        </p>
        <div className="p-4 bg-indigo-950/30 border border-indigo-800/30 rounded-xl">
          <p className="text-xs pacioli-text-secondary leading-relaxed">
            <span className="font-semibold text-indigo-400">Compare this to apps like Mint, YNAB, or Copilot</span> —
            those apps store your transaction history, spending patterns, and sometimes bank credentials on
            their servers. That's a meaningful privacy tradeoff. Pacioli makes the opposite choice.
          </p>
        </div>
        <p className="text-xs pacioli-text-muted leading-relaxed">
          <span className="font-medium pacioli-text-secondary">A note on Plaid:</span> A future version of Pacioli
          will optionally support live bank connections via Plaid. That will change the privacy story — Plaid
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
          I built it with{" "}
          <a
            href="https://claude.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-300 transition-colors inline-flex items-center gap-1"
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
            sub="The AI analyses your last 6 months and suggests a monthly target for each category."
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
