import Link from "next/link";
import { ArrowRight, Check, Code2, ExternalLink, FileCheck2, LockKeyhole, ShieldCheck, X } from "lucide-react";
import { Eyebrow, PublicCta, TextLink } from "@/components/public/marketing-primitives";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "About",
  absoluteTitle: "About CAPYN — The company behind the authority boundary",
  path: "/about",
  description: "Why CAPYN is building explicit, bounded and auditable authority for autonomous agents—and what is real in the public alpha today."
});

const publicRecord = [
  ["Stage", "Public alpha"],
  ["Source", "MIT-licensed engine"],
  ["Custody", "None"],
  ["Execution", "Synthetic in the public demo"],
  ["Current work", "Design partners + production adapters"]
] as const;

const beliefs = [
  {
    title: "Boundaries come before autonomy.",
    copy: "An agent should gain a named capability with explicit constraints—not inherit every action its credential can technically perform."
  },
  {
    title: "Ambiguity must fail closed.",
    copy: "Unknown identity, absent policy, unapproved vendor or malformed intent must stop before consequence."
  },
  {
    title: "A human approves one request.",
    copy: "Approval should release one exact action, not quietly widen the agent’s standing authority."
  },
  {
    title: "Evidence is part of the decision.",
    copy: "Reasons, policy trace and outcome should survive the moment they were produced and remain independently inspectable."
  }
] as const;

const currentBoundary = {
  is: [
    "A deterministic authority layer for autonomous agents",
    "A capability, limit, vendor and approval boundary",
    "A request-bound human decision workflow",
    "A client-verifiable evidence trail",
    "An open-source-first developer product"
  ],
  isNot: [
    "An unrestricted agent wallet",
    "A payment rail or custodian",
    "A token, DAO or speculative network",
    "A production certification claim",
    "A promise that mock execution is real settlement"
  ]
} as const;

const buildStages = [
  ["NOW", "Public alpha", "Mandate Studio, live policy evaluation, request-bound approval, SDK, dashboard and verifiable receipts."],
  ["NEXT", "Production boundary", "Design-partner integrations, durable provider adapters, reconciliation and explicit operational service levels."],
  ["THEN", "General authority", "Extend the same capability model beyond spending to other consequential actions performed by autonomous software."]
] as const;

export default function AboutPage() {
  return (
    <main>
      <section className="relative overflow-hidden border-b border-white/15 bg-code text-white">
        <div className="authority-field-dark pointer-events-none absolute inset-0 opacity-45" />
        <div className="site-container relative py-16 sm:py-24 lg:py-28">
          <div className="grid gap-14 lg:grid-cols-[1.08fr_.92fr] lg:items-end">
            <div>
              <Eyebrow tone="authority">About / public company record</Eyebrow>
              <h1 className="display-title mt-7 max-w-5xl text-balance text-5xl font-semibold leading-[.93] tracking-[-.068em] sm:text-7xl">
                We are building the line between <span className="text-authority">intent</span> and consequence.
              </h1>
              <p className="mt-8 max-w-2xl text-lg leading-9 text-white/60">CAPYN exists because autonomous software needs more than access. It needs explicit authority: what this agent may do, under which limits, when a person must intervene and what evidence remains.</p>
            </div>

            <aside className="border border-white/20 bg-white/[.035]" aria-label="CAPYN public record">
              <div className="flex items-center justify-between border-b border-white/15 px-5 py-4">
                <p className="font-mono text-[9px] uppercase tracking-[.15em] text-white/45">Public record / August 2026</p>
                <ShieldCheck size={15} className="text-authority" />
              </div>
              <dl>
                {publicRecord.map(([term, value]) => (
                  <div key={term} className="grid grid-cols-[7.2rem_1fr] gap-4 border-b border-white/10 px-5 py-4 last:border-0">
                    <dt className="font-mono text-[8px] uppercase tracking-[.12em] text-white/30">{term}</dt>
                    <dd className="text-xs font-bold text-white/[.78]">{value}</dd>
                  </div>
                ))}
              </dl>
            </aside>
          </div>
        </div>
      </section>

      <section className="site-section border-b border-line">
        <div className="site-container grid gap-12 lg:grid-cols-[.68fr_1.32fr]">
          <div>
            <Eyebrow tone="authority">Why this company exists</Eyebrow>
            <h2 className="display-title mt-6 text-4xl font-semibold tracking-[-.055em] sm:text-5xl">Agents can already act. The missing primitive is authority.</h2>
          </div>
          <div className="grid gap-8 text-base leading-8 text-muted sm:grid-cols-2">
            <p>Software credentials answer whether a system can reach an API. They do not, by themselves, express whether this autonomous agent should perform this exact action for this purpose at this moment.</p>
            <p>CAPYN makes that missing decision explicit. Identity, capability, policy, approval, execution state and evidence become one inspectable chain rather than a collection of assumptions spread across systems.</p>
            <blockquote className="border-l-2 border-authority pl-6 text-xl font-extrabold leading-8 text-ink sm:col-span-2 sm:max-w-3xl">The goal is not to make agents less capable. It is to let organisations delegate more—without surrendering control.</blockquote>
          </div>
        </div>
      </section>

      <section className="site-section bg-panel">
        <div className="site-container">
          <div className="grid gap-8 border-b border-line pb-9 lg:grid-cols-[.7fr_1.3fr] lg:items-end">
            <div><Eyebrow>What we believe</Eyebrow><h2 className="display-title mt-6 text-4xl font-semibold tracking-[-.055em] sm:text-5xl">Four rules for delegated software.</h2></div>
            <p className="max-w-2xl text-sm leading-7 text-muted lg:justify-self-end">These are product constraints, not campaign language. They determine what CAPYN evaluates, what it refuses and what it must preserve.</p>
          </div>
          <div className="grid lg:grid-cols-2">
            {beliefs.map((belief, index) => (
              <article key={belief.title} className="grid grid-cols-[2.5rem_1fr] gap-4 border-b border-line py-7 lg:min-h-44 lg:px-7 lg:odd:border-r lg:odd:pl-0 lg:even:pr-0">
                <span className="font-mono text-[9px] text-authority">{String(index + 1).padStart(2, "0")}</span>
                <div><h3 className="text-base font-extrabold">{belief.title}</h3><p className="mt-3 text-sm leading-7 text-muted">{belief.copy}</p></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="site-section border-y border-line">
        <div className="site-container grid gap-12 lg:grid-cols-[.62fr_1.38fr]">
          <div>
            <Eyebrow tone="permission">The current boundary</Eyebrow>
            <h2 className="display-title mt-6 text-4xl font-semibold tracking-[-.055em]">Specific about what CAPYN is. Equally specific about what it is not.</h2>
            <div className="mt-8"><TextLink href="/security">Inspect the security model</TextLink></div>
          </div>
          <div className="grid border border-line sm:grid-cols-2">
            <div className="bg-permission/[.035] p-6 sm:border-r sm:border-line sm:p-8">
              <div className="flex items-center justify-between"><p className="font-mono text-[9px] uppercase tracking-[.14em] text-permission">CAPYN is</p><Check size={16} className="text-permission" /></div>
              <div className="mt-7 space-y-4">{currentBoundary.is.map((item) => <p key={item} className="flex gap-3 border-t border-permission/15 pt-4 text-xs leading-6"><Check size={13} className="mt-1 shrink-0 text-permission" />{item}</p>)}</div>
            </div>
            <div className="border-t border-line bg-denial/[.025] p-6 sm:border-t-0 sm:p-8">
              <div className="flex items-center justify-between"><p className="font-mono text-[9px] uppercase tracking-[.14em] text-denial">CAPYN is not</p><X size={16} className="text-denial" /></div>
              <div className="mt-7 space-y-4">{currentBoundary.isNot.map((item) => <p key={item} className="flex gap-3 border-t border-denial/15 pt-4 text-xs leading-6"><X size={13} className="mt-1 shrink-0 text-denial" />{item}</p>)}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="site-section bg-code text-white">
        <div className="site-container grid gap-12 lg:grid-cols-[.72fr_1.28fr] lg:items-center">
          <div>
            <Eyebrow tone="authority">Built in public</Eyebrow>
            <h2 className="display-title mt-6 text-4xl font-semibold tracking-[-.055em] sm:text-5xl">Proof before mythology.</h2>
            <p className="mt-6 max-w-xl text-base leading-8 text-white/[.58]">The engine is open source. The public demo names its synthetic boundary. The proof viewer recomputes receipt digests locally. Progress is earned in the product rather than implied by a logo wall.</p>
          </div>
          <div className="grid gap-px border border-white/15 bg-white/15 sm:grid-cols-3">
            <a href="https://github.com/meanstackofdoom/capyn" target="_blank" rel="noreferrer" className="group bg-code p-6 transition-colors hover:bg-white/[.04]">
              <Code2 size={18} className="text-authority" /><p className="mt-8 font-mono text-[9px] uppercase tracking-[.14em] text-white/35">Source</p><h3 className="mt-3 text-sm font-extrabold">Read the repository</h3><ExternalLink size={14} className="mt-7 text-white/35 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
            <Link href="/case-studies/procurement-agent" className="group bg-code p-6 transition-colors hover:bg-white/[.04]">
              <FileCheck2 size={18} className="text-review" /><p className="mt-8 font-mono text-[9px] uppercase tracking-[.14em] text-white/35">Boundary File 001</p><h3 className="mt-3 text-sm font-extrabold">Replay the $120 request</h3><ArrowRight size={14} className="mt-7 text-white/35 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="/design-partners" className="group bg-code p-6 transition-colors hover:bg-white/[.04]">
              <LockKeyhole size={18} className="text-permission" /><p className="mt-8 font-mono text-[9px] uppercase tracking-[.14em] text-white/35">Next cohort</p><h3 className="mt-3 text-sm font-extrabold">Bring one real boundary</h3><ArrowRight size={14} className="mt-7 text-white/35 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      <section className="site-section">
        <div className="site-container grid gap-12 lg:grid-cols-[.62fr_1.38fr]">
          <div>
            <Eyebrow tone="authority">Build sequence</Eyebrow>
            <h2 className="display-title mt-6 text-4xl font-semibold tracking-[-.055em]">Earn the right to add complexity.</h2>
            <p className="mt-6 text-sm leading-7 text-muted">The public roadmap is deliberately short. Production claims arrive only after the corresponding boundary is real.</p>
          </div>
          <ol className="border-t border-line">
            {buildStages.map(([signal, title, copy]) => (
              <li key={signal} className="grid gap-4 border-b border-line py-7 sm:grid-cols-[5rem_.62fr_1.38fr] sm:items-start">
                <span className="font-mono text-[9px] text-authority">{signal}</span><h3 className="text-sm font-extrabold">{title}</h3><p className="text-sm leading-7 text-muted">{copy}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <PublicCta />
    </main>
  );
}
