import Link from "next/link";
import { ArrowRight, Check, Code2, FileCheck2, Handshake, ServerCog, ShieldCheck } from "lucide-react";
import { PLAN_CATALOG } from "@capyn/billing";
import { Eyebrow, PublicCta } from "@/components/public/marketing-primitives";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Pricing",
  absoluteTitle: "CAPYN pricing — Free engine, $99 hosted alpha, scoped production",
  path: "/pricing",
  description: "Use CAPYN's open-source engine for free, run a managed hosted alpha for $99 per month, or scope a design-partner and production authority boundary."
});

const offers = [
  {
    signal: "OPEN",
    icon: Code2,
    name: "Developer",
    audience: "Build and self-host",
    price: "$0",
    cadence: "forever",
    availability: "Available now",
    tone: "permission",
    copy: "Use the MIT-licensed policy engine, SDK and public instruments to prove the authority flow before production.",
    features: PLAN_CATALOG.DEVELOPER.features,
    cta: "Use the engine",
    href: "/developers"
  },
  {
    signal: "HOSTED",
    icon: FileCheck2,
    name: "Hosted Alpha",
    audience: "Small agent teams",
    price: "$99",
    cadence: "USD / month",
    availability: "Public-alpha packaging",
    tone: "authority",
    copy: "Managed mandates, approvals and retained evidence with a predictable allowance and an explicit best-effort service boundary.",
    features: ["10 active agents", "100,000 decisions / month", "90-day hosted evidence access", "Request-bound approval operations", "No percentage of agent spend"],
    cta: "Request Hosted Alpha",
    href: "/design-partners"
  },
  {
    signal: "CO-DESIGN",
    icon: Handshake,
    name: "Design Partner",
    audience: "One consequential action",
    price: "From $1,000",
    cadence: "USD / month",
    availability: "Selective 8–12 week engagement",
    tone: "review",
    copy: "Founder-led authority modelling and integration work for teams shaping CAPYN's first production adapters.",
    features: ["One scoped agent action", "Authority-model review", "Integration and reconciliation plan", "Direct product feedback loop", "No implied certification or SLA"],
    cta: "Bring a boundary",
    href: "/design-partners"
  },
  {
    signal: "CONTRACT",
    icon: ServerCog,
    name: "Production",
    audience: "Operational agent systems",
    price: "Custom",
    cadence: "written scope",
    availability: "Not self-serve during alpha",
    tone: "ink",
    copy: "Real execution adapters, infrastructure, support, retention, residency and reliability promises agreed against an explicit production boundary.",
    features: ["Contracted capacity", "Provider adapter and reconciliation scope", "Custom evidence retention", "Private deployment options", "SLA only when written and deliverable"],
    cta: "Discuss the production line",
    href: "/design-partners"
  }
] as const;

const toneClasses = {
  permission: "text-permission",
  authority: "text-authority",
  review: "text-review",
  ink: "text-ink"
} as const;

const pricingAxes = [
  ["Active agents", "How many autonomous identities need a live hosted mandate."],
  ["Evidence window", "How long the organisation needs hosted, queryable decision history."],
  ["Integrations", "Which execution, identity and observability systems cross the boundary."],
  ["Service boundary", "Best effort, founder-supported evaluation or contracted production reliability."]
] as const;

const questions = [
  ["Does CAPYN take a percentage of agent spend?", "No. A $10 request and a $10,000 request each consume one authorization decision. Policy—not pricing—determines whether either action may proceed."],
  ["Why is decision volume not the headline price?", "Authorization checks multiply quickly. Hosted plans include a generous allowance; volume remains an operational guardrail rather than the primary expression of value."],
  ["Is Hosted Alpha a production plan?", "No. It is a managed environment for evaluation and early team workflows. Production adapters, service levels and compliance promises require a written scope."],
  ["Why does a design partnership cost more?", "It includes focused architecture and integration work around one real consequential action. It is a product-shaping engagement, not a discounted SaaS seat."],
  ["Can the policy engine stay self-hosted?", "Yes. The deterministic engine remains MIT-licensed. Hosted fees pay for the managed control plane, evidence, approvals, integrations and operational boundary around it."]
] as const;

export default function PricingPage() {
  return (
    <main>
      <section className="relative overflow-hidden border-b border-white/15 bg-code text-white">
        <div className="authority-field-dark pointer-events-none absolute inset-0 opacity-45" />
        <div className="site-container relative py-16 sm:py-24 lg:py-28">
          <div className="grid gap-14 lg:grid-cols-[1.06fr_.94fr] lg:items-end">
            <div>
              <Eyebrow tone="authority">Pricing / stage-appropriate authority</Eyebrow>
              <h1 className="display-title mt-7 max-w-5xl text-balance text-5xl font-semibold leading-[.93] tracking-[-.068em] sm:text-7xl">
                A free engine. A <span className="text-authority">$99 hosted path.</span> Production by agreement.
              </h1>
              <p className="mt-8 max-w-2xl text-lg leading-9 text-white/60">Pay for operating the authority control plane—not for the value an agent spends, and never for weakening a decision.</p>
            </div>

            <aside className="border border-white/20 bg-white/[.035]" aria-label="CAPYN pricing commitments">
              <div className="flex items-center justify-between border-b border-white/15 px-5 py-4"><p className="font-mono text-[9px] uppercase tracking-[.15em] text-white/45">Commercial commitments</p><ShieldCheck size={15} className="text-authority" /></div>
              {[
                ["NO SPEND CUT", "CAPYN never takes a percentage of money moved."],
                ["APPROVAL INCLUDED", "A safer decision does not create a penalty fee."],
                ["NO IMPLIED SLA", "Production promises begin only in a written agreement."]
              ].map(([signal, copy]) => <div key={signal} className="grid grid-cols-[8.6rem_1fr] gap-4 border-b border-white/10 px-5 py-4 last:border-0"><p className="font-mono text-[8px] tracking-[.11em] text-authority">{signal}</p><p className="text-xs leading-6 text-white/[.58]">{copy}</p></div>)}
            </aside>
          </div>
        </div>
      </section>

      <section className="site-section bg-panel">
        <div className="site-container">
          <div className="grid gap-7 border-b border-line pb-9 lg:grid-cols-[.72fr_1.28fr] lg:items-end">
            <div><Eyebrow>Offer ledger</Eyebrow><h2 className="display-title mt-6 text-4xl font-semibold tracking-[-.055em] sm:text-5xl">Start open. Pay when authority becomes operational.</h2></div>
            <p className="max-w-2xl text-sm leading-7 text-muted lg:justify-self-end">Prices are USD before tax. Public-alpha limits and service boundaries remain explicit so a commercial label never outruns the product.</p>
          </div>

          <div className="border-x border-b border-line bg-paper">
            {offers.map((offer) => {
              const Icon = offer.icon;
              return (
                <article key={offer.name} className="grid border-t border-line lg:grid-cols-[9rem_.72fr_.42fr_1fr]">
                  <div className="flex items-center justify-between border-b border-line px-5 py-5 lg:block lg:border-b-0 lg:border-r lg:px-6 lg:py-8">
                    <Icon size={18} className={toneClasses[offer.tone]} />
                    <p className={`font-mono text-[8px] uppercase tracking-[.14em] lg:mt-8 ${toneClasses[offer.tone]}`}>{offer.signal}</p>
                  </div>
                  <div className="border-b border-line px-5 py-6 lg:border-b-0 lg:border-r lg:px-7 lg:py-8">
                    <p className="font-mono text-[8px] uppercase tracking-[.12em] text-muted">{offer.audience}</p>
                    <h3 className="display-title mt-3 text-3xl font-semibold tracking-[-.05em]">{offer.name}</h3>
                    <p className="mt-4 max-w-md text-sm leading-7 text-muted">{offer.copy}</p>
                  </div>
                  <div className="border-b border-line px-5 py-6 lg:border-b-0 lg:border-r lg:px-7 lg:py-8">
                    <p className="mono-number text-3xl font-semibold tracking-[-.055em]">{offer.price}</p>
                    <p className="mt-2 font-mono text-[8px] uppercase tracking-[.12em] text-muted">{offer.cadence}</p>
                    <p className={`mt-7 text-xs font-bold ${toneClasses[offer.tone]}`}>{offer.availability}</p>
                  </div>
                  <div className="flex flex-col px-5 py-6 lg:px-7 lg:py-8">
                    <div className="space-y-2.5">{offer.features.map((feature) => <p key={feature} className="flex gap-2.5 text-xs leading-5"><Check size={12} className={`mt-1 shrink-0 ${toneClasses[offer.tone]}`} />{feature}</p>)}</div>
                    <Link href={offer.href} className="mt-7 inline-flex min-h-11 items-center justify-between border border-line bg-panel px-4 text-xs font-extrabold transition-colors hover:border-muted">{offer.cta}<ArrowRight size={14} /></Link>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="site-section border-y border-line">
        <div className="site-container grid gap-12 lg:grid-cols-[.65fr_1.35fr]">
          <div>
            <Eyebrow tone="authority">What changes the price</Eyebrow>
            <h2 className="display-title mt-6 text-4xl font-semibold tracking-[-.055em]">Charge for the managed boundary—not for safer outcomes.</h2>
            <p className="mt-6 text-sm leading-7 text-muted">`DENY` and `REQUIRE_APPROVAL` remain first-class decisions. CAPYN does not create an economic incentive to approve more.</p>
          </div>
          <dl className="border-t border-line">
            {pricingAxes.map(([term, description]) => (
              <div key={term} className="grid gap-3 border-b border-line py-6 sm:grid-cols-[.55fr_1.45fr]">
                <dt className="text-sm font-extrabold">{term}</dt><dd className="text-sm leading-7 text-muted">{description}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="site-section bg-code text-white">
        <div className="site-container grid gap-12 lg:grid-cols-[.72fr_1.28fr]">
          <div>
            <Eyebrow tone="authority">Design partner / limited cohort</Eyebrow>
            <h2 className="display-title mt-6 text-4xl font-semibold tracking-[-.055em] sm:text-5xl">One real boundary. Eight to twelve focused weeks.</h2>
            <p className="mt-6 max-w-xl text-base leading-8 text-white/[.58]">The engagement begins with the consequential action—not a broad transformation brief. Scope and fees are agreed manually from $1,000 per month.</p>
            <Link href="/design-partners" className="mt-9 inline-flex min-h-12 items-center gap-2 border border-white bg-white px-6 text-sm font-extrabold text-code">Read the partner brief <ArrowRight size={15} /></Link>
          </div>
          <div className="grid gap-px border border-white/15 bg-white/15 sm:grid-cols-2">
            {[
              ["REQUEST", "Name the exact action that carries consequence."],
              ["MANDATE", "Draw capability, vendor, amount and time boundaries."],
              ["HUMAN", "Place intervention on one request, not standing access."],
              ["EVIDENCE", "Define what must remain after the decision."]
            ].map(([signal, copy]) => <div key={signal} className="bg-code p-6"><p className="font-mono text-[9px] tracking-[.14em] text-authority">{signal}</p><p className="mt-7 text-sm font-bold leading-7">{copy}</p></div>)}
          </div>
        </div>
      </section>

      <section className="site-section">
        <div className="site-container grid gap-12 lg:grid-cols-[.62fr_1.38fr]">
          <div><Eyebrow>Pricing questions</Eyebrow><h2 className="display-title mt-6 text-4xl font-semibold tracking-[-.055em]">The commercial boundary, in plain language.</h2></div>
          <div className="border-t border-line">
            {questions.map(([question, answer]) => <div key={question} className="grid gap-3 border-b border-line py-6 sm:grid-cols-[.8fr_1.2fr]"><h3 className="text-sm font-extrabold leading-6">{question}</h3><p className="text-sm leading-7 text-muted">{answer}</p></div>)}
          </div>
        </div>
      </section>

      <PublicCta />
    </main>
  );
}
