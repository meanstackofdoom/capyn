import Link from "next/link";
import { ArrowRight, Check, Database, Gauge, Infinity as InfinityIcon, LifeBuoy, LockKeyhole, Plug, ShieldCheck, UserCheck } from "lucide-react";
import { PLAN_CATALOG } from "@capyn/billing";
import { Eyebrow, PublicCta, SectionHeading } from "@/components/public/marketing-primitives";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Pricing",
  path: "/pricing",
  description: "Free open-source policy evaluation, bounded hosted plans, and production pricing for managed agent authority."
});

const visiblePlans = [PLAN_CATALOG.DEVELOPER, PLAN_CATALOG.TEAM, PLAN_CATALOG.BUSINESS] as const;

function dollars(cents: number | null): string {
  if (cents === null) return "Custom";
  return `$${(cents / 100).toLocaleString("en-US")}`;
}

function planCta(planId: "DEVELOPER" | "TEAM" | "BUSINESS") {
  if (planId === "DEVELOPER") return { label: "Open the free demo", href: "/dashboard/billing" };
  return { label: `Choose ${PLAN_CATALOG[planId].name}`, href: "/dashboard/billing" };
}

export default function PricingPage() {
  return (
    <main>
      <section className="page-hero overflow-hidden border-b border-line">
        <div className="authority-field pointer-events-none absolute inset-0 opacity-55" />
        <div className="site-container relative grid gap-14 py-16 sm:py-24 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:py-28">
          <div>
            <Eyebrow tone="authority">Pricing / hosted authority</Eyebrow>
            <h1 className="display-title mt-7 max-w-4xl text-balance text-5xl font-semibold leading-[.95] tracking-[-.067em] sm:text-7xl">
              Pay for the control plane. <span className="text-muted">Not a cut of agent spend.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-muted">
              The policy engine stays MIT-licensed and free. Hosted CAPYN charges for decision volume, active agent identities, retained evidence, managed approvals, integrations and production service boundaries.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/dashboard/billing" className="public-primary-button min-h-12 justify-center px-6">Inspect live metering <ArrowRight size={15} /></Link>
              <Link href="/docs/billing" className="public-secondary-button min-h-12 justify-center px-6">Read the billing contract</Link>
            </div>
          </div>

          <div className="border border-line bg-panel shadow-[0_30px_80px_rgba(12,32,48,.10)]">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div><p className="font-mono text-[9px] uppercase tracking-[.15em] text-muted">Usage rail / Team</p><p className="mt-1.5 text-sm font-bold">Predictable base + observable overage</p></div>
              <Gauge size={18} className="text-authority" />
            </div>
            <div className="space-y-6 p-5 sm:p-7">
              {[
                ["Authorization decisions", "42,680", "100,000 included", "42.68%"],
                ["Active agents", "7", "10 included", "70%"],
                ["Integration connections", "2", "3 included", "66.67%"]
              ].map(([label, used, included, width]) => (
                <div key={label}>
                  <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold">{label}</p><p className="mono-number mt-1 text-[10px] text-muted">{used} used</p></div><p className="font-mono text-[9px] text-muted">{included}</p></div>
                  <div className="mt-2 h-2 bg-wash"><div className="h-full bg-authority" style={{ width }} /></div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-px border-t border-line bg-line">
              <div className="bg-paper p-5"><p className="font-mono text-[8px] text-muted">BASE / MONTH</p><p className="mono-number mt-2 text-2xl font-semibold">$99</p></div>
              <div className="bg-paper p-5"><p className="font-mono text-[8px] text-muted">APPROVAL REQUESTS</p><p className="mt-2 text-sm font-bold text-permission">Included</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="site-section bg-panel">
        <div className="site-container">
          <SectionHeading eyebrow="Hosted plans" title="Start free. Pay when authority becomes operational." copy="No transaction percentage and no fee based on the value an agent spends. Prices are USD, before tax, with a monthly billing period." />
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {visiblePlans.map((plan) => {
              const cta = planCta(plan.id);
              const featured = plan.id === "TEAM";
              return (
                <article key={plan.id} className={`flex min-h-[590px] flex-col border bg-paper p-6 sm:p-8 ${featured ? "border-authority shadow-[0_18px_55px_rgba(47,98,221,.10)]" : "border-line"}`}>
                  <div className="flex items-center justify-between gap-4">
                    <p className={`font-mono text-[9px] uppercase tracking-[.15em] ${featured ? "text-authority" : "text-muted"}`}>{plan.id === "DEVELOPER" ? "Available in public alpha" : plan.id === "TEAM" ? "Recommended first paid plan" : "Production packaging"}</p>
                    {featured && <span className="status-dot text-authority" />}
                  </div>
                  <h2 className="display-title mt-5 text-3xl font-semibold tracking-[-.045em]">{plan.name}</h2>
                  <p className="mt-3 min-h-14 text-sm leading-7 text-muted">{plan.description}</p>
                  <div className="mt-7 border-y border-line py-6">
                    <p className="mono-number text-4xl font-semibold tracking-[-.05em]">{dollars(plan.basePriceCents)}{plan.basePriceCents !== 0 && <span className="ml-1 text-xs font-normal tracking-normal text-muted">/ month</span>}</p>
                  </div>
                  <div className="mt-7 space-y-3">
                    {plan.features.map((feature) => <p key={feature} className="flex items-start gap-2.5 text-xs leading-5"><Check size={13} className="mt-1 shrink-0 text-permission" />{feature}</p>)}
                  </div>
                  <div className="mt-auto pt-8">
                    <Link href={cta.href} className={`inline-flex min-h-11 w-full items-center justify-center gap-2 border px-4 text-sm font-bold ${featured ? "border-ink bg-ink text-paper" : "border-line bg-panel"}`}>{cta.label}<ArrowRight size={14} /></Link>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="site-section border-y border-line">
        <div className="site-container grid gap-12 lg:grid-cols-[.7fr_1.3fr]">
          <div>
            <Eyebrow>Metered economics</Eyebrow>
            <h2 className="display-title mt-6 text-4xl font-semibold tracking-[-.055em] sm:text-5xl">Charge for authority operations, never for safer decisions.</h2>
            <p className="mt-6 text-base leading-8 text-muted">DENY and REQUIRE_APPROVAL are first-class decisions. CAPYN meters every authorization result equally and keeps approvals included, so the pricing model does not reward weaker enforcement.</p>
          </div>
          <div className="overflow-x-auto border border-line bg-panel">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead><tr className="border-b border-line font-mono text-[9px] uppercase tracking-[.12em] text-muted"><th className="px-5 py-4 font-normal">Meter</th><th className="px-5 py-4 font-normal">Developer</th><th className="px-5 py-4 font-normal">Team overage</th><th className="px-5 py-4 font-normal">Business overage</th></tr></thead>
              <tbody className="divide-y divide-line text-xs">
                <tr><td className="px-5 py-5 font-bold">Authorization decisions</td><td className="px-5 py-5">10,000 hard limit</td><td className="px-5 py-5 mono-number">$2 / 1,000</td><td className="px-5 py-5 mono-number">$1 / 1,000</td></tr>
                <tr><td className="px-5 py-5 font-bold">Active agents</td><td className="px-5 py-5">3 hard limit</td><td className="px-5 py-5 mono-number">$12 / agent</td><td className="px-5 py-5 mono-number">$8 / agent</td></tr>
                <tr><td className="px-5 py-5 font-bold">Approval requests</td><td className="px-5 py-5 text-permission">Included</td><td className="px-5 py-5 text-permission">Included</td><td className="px-5 py-5 text-permission">Included</td></tr>
                <tr><td className="px-5 py-5 font-bold">Integration connections</td><td className="px-5 py-5">Not included</td><td className="px-5 py-5 mono-number">$29 / connection</td><td className="px-5 py-5 mono-number">$19 / connection</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="site-section bg-code text-white">
        <div className="site-container">
          <SectionHeading eyebrow="Commercial service boundary" title="The software is real. Production promises remain explicit." copy="CAPYN v0.1 includes policy evaluation, quotas, metering, request-bound approvals, audit evidence and a Stripe-ready provider boundary. Contractual features are not represented as shipped before their production gates pass." />
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              [ShieldCheck, "Available now", "Policy engine, agent keys, mandates, decisions, approval workflow, audit events and mock execution."],
              [Gauge, "Payment-ready", "Plan accounting, projected overage, Checkout, customer portal and signed idempotent webhook ingestion."],
              [Plug, "Integration entitlement", "Outbound webhooks and payment adapters are production-gated and delivered through the integration roadmap."],
              [Database, "Retention packaging", "Plan windows describe hosted access. Historical evidence is not silently deleted during alpha or after downgrade."],
              [LockKeyhole, "Business controls", "SSO and SIEM export are Business entitlements, explicitly staged behind production integration work."],
              [LifeBuoy, "Reliability promises", "Priority support, dedicated infrastructure and SLAs begin only under a written Business or Enterprise agreement."]
            ].map(([Icon, title, copy]) => {
              const ItemIcon = Icon as typeof ShieldCheck;
              return <article key={title as string} className="border border-white/15 bg-white/[.03] p-6"><ItemIcon size={17} className="text-permission" /><h3 className="mt-7 text-sm font-bold">{title as string}</h3><p className="mt-3 text-xs leading-6 text-white/55">{copy as string}</p></article>;
            })}
          </div>
        </div>
      </section>

      <section className="site-section">
        <div className="site-container grid gap-5 lg:grid-cols-2">
          <article className="panel p-7 sm:p-10">
            <InfinityIcon size={21} className="text-authority" />
            <p className="mt-8 font-mono text-[9px] uppercase tracking-[.15em] text-muted">Open-source engine</p>
            <h2 className="display-title mt-4 text-3xl font-semibold tracking-[-.045em]">Free forever under MIT.</h2>
            <p className="mt-5 text-sm leading-7 text-muted">Run the deterministic policy evaluator yourself, inspect every rule and build custom execution adapters. Hosted fees pay for operating the control plane around it.</p>
            <Link href="/developers" className="mt-8 inline-flex items-center gap-2 text-sm font-bold">Use the engine <ArrowRight size={14} /></Link>
          </article>
          <article id="design-partner" className="border border-authority bg-panel p-7 sm:p-10">
            <UserCheck size={21} className="text-authority" />
            <p className="mt-8 font-mono text-[9px] uppercase tracking-[.15em] text-authority">Early design partner</p>
            <h2 className="display-title mt-4 text-3xl font-semibold tracking-[-.045em]">$250–$1,000 / month.</h2>
            <p className="mt-5 text-sm leading-7 text-muted">Founder-led integration, authority-model reviews and a tight feedback loop for teams shaping the first production adapters. Scope and fees are agreed manually.</p>
            <Link href="/design-partners" className="mt-8 inline-flex items-center gap-2 text-sm font-bold">See the design-partner brief <ArrowRight size={14} /></Link>
          </article>
        </div>
      </section>

      <section className="border-y border-line bg-panel py-14">
        <div className="site-container flex flex-col justify-between gap-7 lg:flex-row lg:items-center">
          <div><p className="font-mono text-[9px] uppercase tracking-[.15em] text-muted">Enterprise</p><h2 className="display-title mt-3 text-3xl font-semibold tracking-[-.045em]">Dedicated infrastructure, SLAs, compliance and private deployment.</h2></div>
          <Link href="/design-partners" className="public-primary-button min-h-12 shrink-0 justify-center px-6">Discuss a scoped agreement <ArrowRight size={15} /></Link>
        </div>
      </section>

      <PublicCta />
    </main>
  );
}
