import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";
import { AuthorityCampaign } from "@/components/public/authority-campaign";
import { AuthorityConsole } from "@/components/public/authority-console";
import { MandateResume } from "@/components/public/mandate-resume";
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
        "Client-verifiable decision receipts"
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
              Write one exact action below. CAPYN evaluates the live mandate, stops or advances it, then issues proof you can verify without trusting us.
            </p>
            <div className="home-hero__actions">
              <Link href="/start" className="public-primary-button min-h-12 justify-center px-6">Build your mandate <ArrowRight size={16} /></Link>
              <Link href="#authority-check" className="public-secondary-button min-h-12 justify-center px-6">Test an action <ArrowDown size={16} /></Link>
            </div>
          </div>

          <div className="home-hero__boundary enter-control">
            <AuthorityConsole />
          </div>

        </div>
      </section>

      <MandateResume />

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

      <PublicCta />
    </main>
  );
}
