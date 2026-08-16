import Link from "next/link";
import { ArrowRight, Check, ChevronRight, CircleDollarSign, Fingerprint, Gauge, KeyRound, LockKeyhole, Network, ScrollText, ShieldCheck, UserCheck, X } from "lucide-react";
import { AuthorityConsole } from "@/components/public/authority-console";
import { CodeWindow, Eyebrow, PublicCta, SectionHeading, SecuritySeal, TextLink } from "@/components/public/marketing-primitives";
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

const lifecycle = [
  { icon: Fingerprint, label: "Identity", copy: "Which authenticated agent is asking?" },
  { icon: KeyRound, label: "Mandate", copy: "What authority was delegated, and until when?" },
  { icon: Gauge, label: "Policy", copy: "Do capability, vendor and spend constraints pass?" },
  { icon: UserCheck, label: "Approval", copy: "Does this exact request require a human?" },
  { icon: ScrollText, label: "Evidence", copy: "Can every decision and action be reconstructed?" }
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
      <section className="relative overflow-hidden border-b border-line">
        <div className="authority-field pointer-events-none absolute inset-x-0 top-0 h-[760px] opacity-60" />
        <div className="site-container relative grid gap-14 pb-20 pt-16 sm:pt-24 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:pb-28 lg:pt-28">
          <div className="enter-control max-w-3xl">
            <Eyebrow tone="authority">Programmable authority / v0.1</Eyebrow>
            <h1 className="display-title mt-7 text-balance text-[clamp(3.7rem,7.3vw,7.6rem)] font-semibold leading-[.88] tracking-[-.078em]">
              Give agents authority.
              <span className="mt-2 block text-muted">Not unlimited access.</span>
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-8 text-muted sm:text-xl sm:leading-9">
              CAPYN is the authorization control plane for autonomous agents—capabilities, hard limits, approvals and audit evidence before consequential actions execute.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/dashboard" className="public-primary-button min-h-12 justify-center px-6">Inspect the working demo <ArrowRight size={16} /></Link>
              <Link href="/product" className="public-secondary-button min-h-12 justify-center px-6">Explore the authority model <ChevronRight size={16} /></Link>
            </div>
            <div className="mt-9 flex flex-wrap gap-2">
              <SecuritySeal>Fail closed</SecuritySeal>
              <SecuritySeal>Request-bound approval</SecuritySeal>
              <SecuritySeal>Integer money accounting</SecuritySeal>
            </div>
          </div>
          <div className="enter-control relative mx-auto w-full max-w-xl [animation-delay:100ms]">
            <div className="absolute -left-7 top-14 hidden h-[72%] w-px bg-authority/30 lg:block" />
            <div className="absolute -left-[31px] top-14 hidden h-2 w-2 rounded-full bg-authority lg:block" />
            <AuthorityConsole />
          </div>
        </div>
        <div className="site-container relative pb-8">
          <div className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
            {lifecycle.map(({ icon: Icon, label, copy }) => (
              <div key={label} className="bg-panel p-5">
                <div className="flex items-center gap-3"><Icon size={15} className="text-authority" /><p className="text-xs font-extrabold">{label}</p></div>
                <p className="mt-3 text-[11px] leading-5 text-muted">{copy}</p>
              </div>
            ))}
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
