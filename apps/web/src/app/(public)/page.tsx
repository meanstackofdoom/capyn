import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { AuthorityCampaign } from "@/components/public/authority-campaign";
import { AuthorityConsole } from "@/components/public/authority-console";
import { DelegatedEnvelope } from "@/components/public/delegated-envelope";
import { CodeWindow, Eyebrow, PublicCta, TextLink } from "@/components/public/marketing-primitives";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Authority infrastructure for autonomous agents",
  absoluteTitle: "CAPYN — Authority infrastructure for autonomous agents",
  path: "/",
  description: "Give AI agents permission to spend and act within explicit capabilities, limits, vendor policies and human approval thresholds.",
  keywords: ["AI agent authorization", "agent spending controls", "agent IAM", "agent payment policy"]
});

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

      <DelegatedEnvelope />

      <AuthorityCampaign />

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
