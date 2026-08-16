import Link from "next/link";
import { ArrowRight, Check, Clock3, Database, Fingerprint, Gauge, KeyRound, LockKeyhole, Play, ScrollText, ShieldCheck, UserCheck, X } from "lucide-react";
import { AuthorityRequest, Eyebrow, PublicCta, SectionHeading, TextLink } from "@/components/public/marketing-primitives";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Product",
  path: "/product",
  description: "Identity, mandates, policy evaluation, request-bound approvals, controlled execution and complete audit evidence for autonomous agents."
});

const flow = [
  { icon: Fingerprint, title: "Authenticate the agent", copy: "A revocable API credential resolves to exactly one agent and organisation. The request body cannot choose another identity." },
  { icon: KeyRound, title: "Load its active mandate", copy: "Versioned, time-bounded authority defines capabilities and policy. Missing or expired authority closes the request." },
  { icon: ShieldCheck, title: "Evaluate every gate", copy: "Capability, vendor, per-action limit, daily and monthly budgets, agent state and expiry are evaluated deterministically." },
  { icon: UserCheck, title: "Pause exact requests", copy: "Threshold crossings create one request-specific approval. A human decision does not create blanket future permission." },
  { icon: Play, title: "Execute once", copy: "Only valid allowed or approved authorizations reach an executor. Replay resolves to the original result rather than moving value twice." },
  { icon: ScrollText, title: "Retain the evidence", copy: "Each transition is written to an append-oriented audit stream with the actor, entity, timestamp and safe metadata." }
] as const;

const policies = [
  ["Capability", "spend.compute", "The requested capability must exist on the active mandate."],
  ["Vendor allowlist", "OpenAI · Anthropic · AWS", "Unknown vendors are denied before execution."],
  ["Per transaction", "$150 hard ceiling", "Approval never overrides the hard ceiling."],
  ["Daily budget", "$200 / UTC day", "Live reservations count toward the projected spend."],
  ["Monthly budget", "$2,000 / calendar month", "The same currency and calendar window are evaluated."],
  ["Approval threshold", "> $100", "Requests from $100.01–$150 pause for human review."],
  ["Agent + mandate state", "Active and unexpired", "Suspension, revocation or expiry closes authority immediately."]
] as const;

export default function ProductPage() {
  return (
    <main>
      <section className="page-hero border-b border-line">
        <div className="authority-field pointer-events-none absolute inset-0 opacity-45" />
        <div className="site-container relative grid gap-12 py-16 sm:py-24 lg:grid-cols-[1fr_.9fr] lg:items-center lg:py-28">
          <div>
            <Eyebrow tone="authority">Product / authority control plane</Eyebrow>
            <h1 className="display-title mt-7 max-w-4xl text-balance text-5xl font-semibold leading-[.96] tracking-[-.065em] sm:text-7xl">One boundary between an agent’s intent and execution.</h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-muted">CAPYN turns organisational intent into a machine-enforceable mandate, evaluates every requested action, pauses the ones that need a person and records what happened.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/dashboard" className="public-primary-button min-h-12 justify-center px-6">Inspect the control plane <ArrowRight size={15} /></Link>
              <Link href="/developers" className="public-secondary-button min-h-12 justify-center px-6">Integrate an agent</Link>
            </div>
          </div>
          <div className="mx-auto w-full max-w-lg"><AuthorityRequest vendor="OpenAI" amount="$18.00" decision="ALLOW" compact /></div>
        </div>
      </section>

      <section id="architecture" className="site-section bg-panel">
        <div className="site-container">
          <SectionHeading eyebrow="The authority lifecycle" title="Clear boundaries from identity to evidence." copy="Each layer has one job. Payment adapters cannot decide policy, and the frontend never becomes the security boundary." />
          <div className="mt-14 grid gap-px border border-line bg-line md:grid-cols-2 lg:grid-cols-3">
            {flow.map(({ icon: Icon, title, copy }, index) => (
              <article key={title} className="relative bg-paper p-7 sm:p-8">
                <div className="flex items-center justify-between"><Icon size={19} className="text-authority" /><span className="font-mono text-[9px] text-muted">{String(index + 1).padStart(2, "0")}</span></div>
                <h2 className="mt-12 text-lg font-extrabold">{title}</h2>
                <p className="mt-3 text-sm leading-7 text-muted">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="site-section border-y border-line">
        <div className="site-container grid gap-12 lg:grid-cols-[.72fr_1.28fr]">
          <div>
            <Eyebrow>Policy model / seeded mandate</Eyebrow>
            <h2 className="display-title mt-6 text-4xl font-semibold leading-[1.02] tracking-[-.055em] sm:text-5xl">Authority people can read and machines can enforce.</h2>
            <p className="mt-6 text-base leading-8 text-muted">A mandate names the allowed capabilities and carries the policies that narrow them. CAPYN evaluates the same contract for every request.</p>
            <div className="mt-8 border border-line bg-panel p-5">
              <p className="font-mono text-[9px] uppercase tracking-[.15em] text-muted">procurement-agent / active mandate</p>
              <div className="mt-4 flex flex-wrap gap-2"><span className="policy-chip">spend.compute</span><span className="policy-chip">spend.api</span><span className="policy-chip policy-chip-denied">transfer.wallet denied</span></div>
              <div className="mt-5 flex items-center gap-2 text-xs text-muted"><Clock3 size={14} /> Valid until 30 Sep 2026</div>
            </div>
          </div>
          <div className="overflow-hidden border border-line bg-panel">
            <div className="grid grid-cols-[.8fr_.8fr_1.4fr] border-b border-line px-5 py-3 font-mono text-[8px] uppercase tracking-[.14em] text-muted sm:px-6">
              <span>Rule</span><span>Configuration</span><span className="hidden sm:block">Enforcement</span>
            </div>
            {policies.map(([rule, configuration, enforcement]) => (
              <div key={rule} className="grid gap-2 border-b border-line/70 px-5 py-5 last:border-0 sm:grid-cols-[.8fr_.8fr_1.4fr] sm:px-6">
                <p className="text-xs font-extrabold">{rule}</p>
                <p className="font-mono text-[10px] text-authority">{configuration}</p>
                <p className="text-xs leading-5 text-muted">{enforcement}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="site-section bg-code text-white">
        <div className="site-container">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-end">
            <div>
              <Eyebrow tone="permission">Decisions are composable</Eyebrow>
              <h2 className="display-title mt-6 text-4xl font-semibold tracking-[-.055em] sm:text-5xl">Hard failures always win.</h2>
            </div>
            <p className="max-w-xl text-base leading-8 text-white/60">An approval threshold cannot rescue an ungranted capability, unknown vendor or exceeded hard limit. Approval is a pause inside the permitted envelope—not an escape hatch around it.</p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[{ icon: Check, label: "ALLOW", copy: "All hard rules pass and no human review is required.", tone: "text-permission" }, { icon: LockKeyhole, label: "REQUIRE_APPROVAL", copy: "Hard rules pass, but this exact request crosses the review threshold.", tone: "text-review" }, { icon: X, label: "DENY", copy: "One or more hard rules fail, or CAPYN cannot establish authority.", tone: "text-denial" }].map(({ icon: Icon, label, copy, tone }) => (
              <div key={label} className="border border-white/15 bg-white/[.03] p-6"><Icon size={18} className={tone} /><p className={`mt-8 font-mono text-[11px] ${tone}`}>{label}</p><p className="mt-3 text-sm leading-7 text-white/55">{copy}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="site-section">
        <div className="site-container grid gap-6 lg:grid-cols-2">
          <div className="panel p-7 sm:p-10">
            <Gauge size={21} className="text-authority" />
            <h2 className="display-title mt-8 text-3xl font-semibold tracking-[-.045em]">Concurrent spend stays inside the budget.</h2>
            <p className="mt-5 text-sm leading-7 text-muted">PostgreSQL authorization and approval operations use serializable transactions, a per-agent advisory lock and projected spend that includes live reservations.</p>
            <div className="mt-8"><TextLink href="/security#concurrency">Read the concurrency model</TextLink></div>
          </div>
          <div className="panel p-7 sm:p-10">
            <Database size={21} className="text-authority" />
            <h2 className="display-title mt-8 text-3xl font-semibold tracking-[-.045em]">Settlement is an adapter, not a policy decision.</h2>
            <p className="mt-5 text-sm leading-7 text-muted">The v0.1 executor simulates payment. Solana/USDC, x402, Stripe or another rail can be added behind the same one-time execution contract.</p>
            <div className="mt-8"><TextLink href="/about#roadmap">See the roadmap boundary</TextLink></div>
          </div>
        </div>
      </section>

      <PublicCta />
    </main>
  );
}
