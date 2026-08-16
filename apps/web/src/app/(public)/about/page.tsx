import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, CircleDollarSign, FileKey2, ScrollText, WalletCards, X } from "lucide-react";
import { Eyebrow, PublicCta, SectionHeading, TextLink } from "@/components/public/marketing-primitives";

export const metadata: Metadata = {
  title: "About",
  description: "CAPYN's thesis: autonomous agents need explicit, bounded and auditable authority before they perform consequential actions."
};

const framework = [
  ["Authentication", "Who is the agent?"],
  ["Authorization", "What may the agent do?"],
  ["Intent", "What exact action was requested?"],
  ["Policy", "Under which constraints?"],
  ["Execution", "What actually happened?"],
  ["Audit", "Can the organisation prove it?"]
] as const;

const roadmap = [
  { state: "NOW", title: "Developer MVP", copy: "Policy engine, API, request approvals, mock execution, SDK, dashboard, seeded scenarios and audit evidence." },
  { state: "NEXT", title: "Public alpha", copy: "Public repository, hosted product site, concurrency demonstration, launch technical note and a small cohort of agent builders." },
  { state: "THEN", title: "Real execution adapters", copy: "Provider idempotency, reconciliation and selected settlement integrations without moving authorization into the rail." },
  { state: "LATER", title: "General authority", copy: "Extend the mandate and capability model beyond spending to other consequential operations performed by autonomous software." }
] as const;

export default function AboutPage() {
  return (
    <main>
      <section className="page-hero border-b border-line">
        <div className="authority-field pointer-events-none absolute inset-0 opacity-45" />
        <div className="site-container relative py-16 sm:py-24 lg:py-32">
          <Eyebrow tone="authority">About / the authority problem</Eyebrow>
          <h1 className="display-title mt-7 max-w-5xl text-balance text-5xl font-semibold leading-[.94] tracking-[-.067em] sm:text-7xl lg:text-8xl">Autonomy without bounded authority is just uncontrolled access.</h1>
          <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_.65fr]">
            <p className="max-w-2xl text-lg leading-9 text-muted">AI agents are becoming capable of buying services, invoking paid APIs and moving value. The question is no longer whether they can act. It is whether an organisation can define, enforce and prove what they were allowed to do.</p>
            <div className="border-l-2 border-authority pl-6"><p className="font-mono text-[10px] uppercase tracking-[.16em] text-authority">CAPYN thesis</p><p className="mt-4 text-xl font-extrabold leading-8">Agents can already pay. The missing layer is authority.</p></div>
          </div>
        </div>
      </section>

      <section className="site-section bg-panel">
        <div className="site-container grid gap-12 lg:grid-cols-[.7fr_1.3fr]">
          <div>
            <Eyebrow>The agent authority problem</Eyebrow>
            <h2 className="display-title mt-6 text-4xl font-semibold tracking-[-.055em] sm:text-5xl">Six separate questions. One evidence chain.</h2>
            <p className="mt-6 text-base leading-8 text-muted">Treating these as one vague “payment” problem hides the boundaries that make delegation safe.</p>
          </div>
          <div className="border border-line bg-paper">
            {framework.map(([term, question], index) => (
              <div key={term} className="grid grid-cols-[34px_.7fr_1.3fr] items-center gap-4 border-b border-line/70 px-5 py-5 last:border-0 sm:px-7">
                <span className="font-mono text-[8px] text-muted">{String(index + 1).padStart(2, "0")}</span>
                <p className="text-xs font-extrabold">{term}</p>
                <p className="text-xs leading-5 text-muted">{question}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="site-section border-y border-line">
        <div className="site-container">
          <SectionHeading eyebrow="A precise category" title="An authority control plane—not another payment rail." copy="CAPYN starts immediately before execution and ends with evidence of what happened. That boundary keeps the product useful across networks and providers." />
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <div className="border border-permission/25 bg-permission/[.04] p-7 sm:p-9">
              <div className="flex items-center justify-between"><p className="font-mono text-[10px] uppercase tracking-[.15em] text-permission">CAPYN is</p><Check size={18} className="text-permission" /></div>
              <div className="mt-8 grid gap-4">
                {["An identity and mandate boundary for autonomous agents", "A deterministic policy evaluator with explicit reason codes", "A request-bound approval and replay-prevention layer", "A chain-agnostic control point before execution", "An append-oriented evidence trail"].map((item) => <div key={item} className="flex gap-3 border-t border-permission/15 pt-4 text-sm leading-6"><Check size={14} className="mt-1 shrink-0 text-permission" />{item}</div>)}
              </div>
            </div>
            <div className="border border-denial/20 bg-denial/[.035] p-7 sm:p-9">
              <div className="flex items-center justify-between"><p className="font-mono text-[10px] uppercase tracking-[.15em] text-denial">CAPYN is not</p><X size={18} className="text-denial" /></div>
              <div className="mt-8 grid gap-4">
                {["An unrestricted wallet for agents", "A token, DAO or speculative network", "A replacement for x402, Solana, Stripe or AP2", "A browser-only policy interface", "A claim that the v0.1 mock executor is production custody"].map((item) => <div key={item} className="flex gap-3 border-t border-denial/15 pt-4 text-sm leading-6"><X size={14} className="mt-1 shrink-0 text-denial" />{item}</div>)}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="site-section bg-code text-white">
        <div className="site-container grid gap-12 lg:grid-cols-[.82fr_1.18fr] lg:items-center">
          <div>
            <Eyebrow tone="permission">Why start with money?</Eyebrow>
            <h2 className="display-title mt-6 text-4xl font-semibold tracking-[-.055em] sm:text-5xl">Financial authority makes every ambiguity visible.</h2>
            <p className="mt-6 max-w-xl text-base leading-8 text-white/60">Money forces precise answers about identity, limits, approval, concurrency, replay and audit. Solving those constraints creates a strong base for a more general capability layer.</p>
          </div>
          <div className="grid gap-px border border-white/15 bg-white/15 sm:grid-cols-2">
            {[{ icon: CircleDollarSign, title: "Exact amounts", copy: "Integer minor units and explicit currency." }, { icon: FileKey2, title: "Explicit mandate", copy: "Named capabilities with time-bounded authority." }, { icon: WalletCards, title: "Constrained spend", copy: "Vendor and window limits before execution." }, { icon: ScrollText, title: "Provable outcome", copy: "Decision, approval and execution evidence." }].map(({ icon: Icon, title, copy }) => <div key={title} className="bg-code p-6"><Icon size={18} className="text-permission" /><h3 className="mt-8 text-sm font-extrabold">{title}</h3><p className="mt-3 text-xs leading-6 text-white/50">{copy}</p></div>)}
          </div>
        </div>
      </section>

      <section id="roadmap" className="site-section">
        <div className="site-container grid gap-12 lg:grid-cols-[.7fr_1.3fr]">
          <div>
            <Eyebrow tone="authority">Roadmap / boundary first</Eyebrow>
            <h2 className="display-title mt-6 text-4xl font-semibold tracking-[-.055em] sm:text-5xl">Earn the right to add complexity.</h2>
            <p className="mt-6 text-base leading-8 text-muted">CAPYN will not move into blockchain, token or network complexity until the core authority system is solid and useful to real builders.</p>
            <div className="mt-8"><TextLink href="/dashboard">Inspect what already works</TextLink></div>
          </div>
          <div className="authority-corridor pl-8">
            {roadmap.map((item) => (
              <article key={item.state} className="relative border-b border-line py-7 first:pt-0 last:border-0 last:pb-0">
                <span className="absolute -left-[37px] top-8 h-3 w-3 rounded-full border-2 border-paper bg-authority first:top-1" />
                <div className="grid gap-3 sm:grid-cols-[72px_1fr]"><span className="font-mono text-[9px] text-authority">{item.state}</span><div><h3 className="text-base font-extrabold">{item.title}</h3><p className="mt-3 text-sm leading-7 text-muted">{item.copy}</p></div></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-panel">
        <div className="site-container grid gap-8 py-12 sm:grid-cols-[1fr_auto] sm:items-center">
          <div><p className="font-mono text-[9px] uppercase tracking-[.16em] text-muted">Current status</p><p className="display-title mt-3 text-2xl font-semibold tracking-[-.04em]">CAPYN v0.1 is a working developer MVP.</p></div>
          <Link href="/developers" className="public-primary-button justify-center">Run it locally <ArrowRight size={15} /></Link>
        </div>
      </section>

      <PublicCta />
    </main>
  );
}
