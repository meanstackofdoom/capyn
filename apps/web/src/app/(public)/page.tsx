import Link from "next/link";
import { ArrowRight, Check, ChevronRight, CircleDollarSign, Fingerprint, KeyRound, LockKeyhole, Network, ShieldCheck, X } from "lucide-react";
import { AuthorityCampaign } from "@/components/public/authority-campaign";
import { AuthorityConsole } from "@/components/public/authority-console";
import { CodeWindow, Eyebrow, PublicCta, SectionHeading, TextLink } from "@/components/public/marketing-primitives";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Authority infrastructure for autonomous agents",
  absoluteTitle: "CAPYN — Authority infrastructure for autonomous agents",
  path: "/",
  description: "Give AI agents permission to spend and act within explicit capabilities, limits, vendor policies and human approval thresholds.",
  keywords: ["AI agent authorization", "agent spending controls", "agent IAM", "agent payment policy"]
});

const decisions = [
  { amount: "$18.00", vendor: "OpenAI", capability: "spend.compute", decision: "ALLOW", reason: "All delegated limits pass", tone: "permission" },
  { amount: "$30.00", vendor: "UnknownVendor", capability: "spend.api", decision: "DENY", reason: "VENDOR_NOT_ALLOWED", tone: "denial" },
  { amount: "$120.00", vendor: "AWS", capability: "spend.compute", decision: "APPROVAL", reason: "Threshold exceeded", tone: "review" }
] as const;

const sdkExample = `import { Capyn } from "@capyn/sdk";

const capyn = new Capyn({
  apiKey: process.env.CAPYN_API_KEY!
});

const result = await capyn.authorize({
  capability: "spend.compute",
  amount: { value: "18.00", currency: "USD" },
  vendor: { id: "openai" },
  metadata: { purpose: "Inference capacity" }
});

// result.decision → "ALLOW"`;

export default function HomePage() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3010";
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "CAPYN",
      url: siteUrl,
      description: "Authority infrastructure for autonomous agents."
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "CAPYN",
      applicationCategory: "SecurityApplication",
      operatingSystem: "Web, Node.js",
      softwareVersion: "0.1.0",
      description: "A programmable authorization control plane for autonomous agents with capabilities, limits, approvals and audit evidence.",
      url: siteUrl,
      codeRepository: "https://github.com/meanstackofdoom/capyn",
      license: "https://opensource.org/license/mit",
      featureList: [
        "Agent-scoped API credentials",
        "Versioned authority mandates",
        "Deterministic spending policy evaluation",
        "Request-bound human approvals",
        "Append-oriented audit evidence"
      ],
      offers: [
        { "@type": "Offer", name: "Developer", price: "0", priceCurrency: "USD" },
        { "@type": "Offer", name: "Team", price: "99", priceCurrency: "USD" },
        { "@type": "Offer", name: "Business", price: "499", priceCurrency: "USD" }
      ]
    }
  ];
  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <section className="home-hero">
        <div className="home-hero__atmosphere" aria-hidden="true" />
        <div className="site-container home-hero__shell">
          <div className="home-hero__meta enter-control">
            <Eyebrow tone="authority">Programmable authority / public alpha</Eyebrow>
            <p>Open source · Mock execution · No customer funds</p>
          </div>

          <h1 className="home-hero__title display-title enter-control">
            <span>Give agents <em>authority.</em></span>
            <span className="home-hero__title-boundary">Not unlimited access.</span>
          </h1>

          <div className="home-hero__intro enter-control">
            <p>
              The authorization layer between what an autonomous agent wants to do and what your systems should permit—capabilities, hard limits, human approvals and evidence in one decision point.
            </p>
            <div className="home-hero__actions">
              <Link href="/lab" className="public-primary-button min-h-12 justify-center px-6">Enter the Authority Lab <ArrowRight size={16} /></Link>
              <Link href="/product" className="public-secondary-button min-h-12 justify-center px-6">See how authority works <ChevronRight size={16} /></Link>
            </div>
          </div>

          <div className="home-hero__boundary enter-control">
            <AuthorityConsole />
          </div>

          <div className="home-hero__proof" aria-label="Core product guarantees">
            <div><span>Fail closed</span><p>Ambiguity never becomes permission.</p></div>
            <div><span>Request-bound</span><p>One approval unlocks one exact action.</p></div>
            <div><span>Non-custodial</span><p>CAPYN decides; your chosen rail executes.</p></div>
            <div><span>Explainable</span><p>Every outcome carries reasons and evidence.</p></div>
          </div>
        </div>
      </section>

      <section className="site-section bg-panel">
        <div className="site-container grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
          <div className="lg:sticky lg:top-28">
            <Eyebrow>Authority before execution</Eyebrow>
            <h2 className="display-title mt-6 text-4xl font-semibold leading-[1.02] tracking-[-.055em] sm:text-6xl">Agents can already pay. The missing layer is authority.</h2>
            <p className="mt-6 max-w-xl text-base leading-8 text-muted">CAPYN does not replace a wallet, payment protocol or settlement network. It answers the question each of them needs answered first: may this agent perform this exact action?</p>
          </div>
          <div className="border border-line bg-paper p-5 sm:p-8">
            <div className="mx-auto max-w-xl">
              <div className="border border-authority/30 bg-authority px-6 py-5 text-white shadow-[0_14px_40px_rgba(47,98,221,.18)]">
                <div className="flex items-center justify-between gap-4"><span className="display-title text-xl font-semibold">CAPYN</span><span className="font-mono text-[9px] uppercase tracking-[.15em] text-white/60">Authority control plane</span></div>
              </div>
              <div className="mx-auto h-12 w-px bg-line" />
              <div className="grid grid-cols-3 gap-2">
                {[[Fingerprint, "Identity"], [KeyRound, "Mandate"], [ShieldCheck, "Policy"]].map(([Icon, label]) => {
                  const RailIcon = Icon as typeof Fingerprint;
                  return <div key={label as string} className="border border-line bg-panel p-4 text-center"><RailIcon className="mx-auto text-authority" size={16} /><p className="mt-2 font-mono text-[9px]">{label as string}</p></div>;
                })}
              </div>
              <div className="mx-auto h-12 w-px bg-line" />
              <div className="grid grid-cols-3 gap-2 font-mono text-[9px]">
                <span className="border border-line bg-panel px-3 py-3 text-center">x402</span>
                <span className="border border-line bg-panel px-3 py-3 text-center">SOLANA / USDC</span>
                <span className="border border-line bg-panel px-3 py-3 text-center">STRIPE / AP2</span>
              </div>
            </div>
            <div className="mt-8 flex items-start gap-3 border-t border-line pt-5 text-xs leading-6 text-muted"><Network size={16} className="mt-1 shrink-0 text-authority" /> The policy engine stays chain-agnostic. Execution adapters move value; they do not decide permission.</div>
          </div>
        </div>
      </section>

      <AuthorityCampaign />

      <section className="site-section border-y border-line">
        <div className="site-container">
          <SectionHeading eyebrow="One request, one decision" title="A policy result an agent can act on—and a human can explain." copy="Each response carries a deterministic decision, machine-readable reasons and the authorization evidence needed to investigate it later." />
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {decisions.map((item) => (
              <article key={item.decision} className="panel flex min-h-[310px] flex-col p-6 sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div><p className="font-mono text-[9px] uppercase tracking-[.14em] text-muted">procurement-agent</p><h3 className="mt-3 text-xl font-extrabold">{item.amount} <span className="text-muted">→</span> {item.vendor}</h3></div>
                  <CircleDollarSign size={19} className="text-muted" />
                </div>
                <p className="mt-7 border-y border-line py-4 font-mono text-[10px] text-muted">capability / {item.capability}</p>
                <div className="mt-auto pt-8">
                  <div className={`inline-flex items-center gap-2 border px-3 py-2 font-mono text-[10px] font-medium ${item.tone === "permission" ? "border-permission/30 bg-permission/10 text-permission" : item.tone === "denial" ? "border-denial/30 bg-denial/10 text-denial" : "border-review/30 bg-review/10 text-review"}`}>
                    {item.tone === "permission" ? <Check size={13} /> : item.tone === "denial" ? <X size={13} /> : <LockKeyhole size={13} />}{item.decision}
                  </div>
                  <p className="mt-3 font-mono text-[9px] text-muted">{item.reason}</p>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-8"><TextLink href="/product">See every policy gate</TextLink></div>
        </div>
      </section>

      <section className="site-section bg-code text-white">
        <div className="site-container grid gap-12 lg:grid-cols-[.85fr_1.15fr] lg:items-center">
          <div>
            <Eyebrow tone="permission">Developer-first authority</Eyebrow>
            <h2 className="display-title mt-6 text-4xl font-semibold leading-[1.03] tracking-[-.055em] sm:text-5xl">One typed call before the agent acts.</h2>
            <p className="mt-6 max-w-lg text-base leading-8 text-white/60">Authenticate the agent with its own revocable key. CAPYN infers identity server-side, evaluates the active mandate, and returns the exact next step.</p>
            <div className="mt-8"><TextLink href="/developers" inverse>Read the developer guide</TextLink></div>
          </div>
          <CodeWindow label="agent.ts" code={sdkExample} />
        </div>
      </section>

      <section className="site-section">
        <div className="site-container grid gap-8 lg:grid-cols-2">
          <div className="border border-line bg-panel p-7 sm:p-10">
            <Eyebrow tone="permission">Security boundary</Eyebrow>
            <h2 className="display-title mt-6 text-3xl font-semibold tracking-[-.045em]">Deny what the system cannot prove.</h2>
            <p className="mt-5 text-sm leading-7 text-muted">Unknown agent, expired mandate, missing capability, unapproved vendor, exceeded hard limit or malformed policy: CAPYN fails closed with an explicit reason.</p>
            <div className="mt-8"><TextLink href="/security">Inspect the security model</TextLink></div>
          </div>
          <div className="border border-line bg-panel p-7 sm:p-10">
            <Eyebrow tone="authority">Complete evidence</Eyebrow>
            <h2 className="display-title mt-6 text-3xl font-semibold tracking-[-.045em]">Every consequential transition becomes an audit event.</h2>
            <p className="mt-5 text-sm leading-7 text-muted">Requests, denials, approvals, revocations and executions are recorded in an append-oriented event stream with organisation and actor context.</p>
            <div className="mt-8"><TextLink href="/dashboard/audit">View the demo audit log</TextLink></div>
          </div>
        </div>
      </section>

      <PublicCta />
    </main>
  );
}
