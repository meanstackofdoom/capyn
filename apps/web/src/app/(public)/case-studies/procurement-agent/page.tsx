import Link from "next/link";
import { ArrowRight, Check, FileCheck2, Fingerprint, LockKeyhole, ShieldCheck } from "lucide-react";
import { AuthorityConsole } from "@/components/public/authority-console";
import { Eyebrow, PublicCta, TextLink } from "@/components/public/marketing-primitives";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Procurement agent authority case study",
  absoluteTitle: "Boundary File 001 — The $120 procurement request · CAPYN",
  path: "/case-studies/procurement-agent",
  description: "Replay a synthetic procurement-agent request as it crosses a live CAPYN mandate, reaches a human approval line and produces verifiable evidence.",
  keywords: ["AI agent authorization case study", "agent procurement controls", "human approval AI agent", "agent audit evidence"]
});

const mandateRows = [
  ["Agent identity", "procurement-agent"],
  ["Granted capability", "spend.compute"],
  ["Approved vendor", "AWS"],
  ["Hard ceiling", "$150 / action"],
  ["Human line", "$100 / action"]
] as const;

const evidenceSequence = [
  ["Request", "The exact capability, vendor, amount and purpose are bound together."],
  ["Policy", "Nine deterministic gates evaluate the active mandate."],
  ["Human", "The request pauses because $120 crosses the $100 approval line."],
  ["Proof", "The decision and ordered events become a digest-verifiable receipt."]
] as const;

export default function ProcurementAgentCaseStudyPage() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3010";
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: "Boundary File 001: The $120 procurement request",
    description: "An executable reference implementation of bounded procurement authority for an autonomous agent.",
    url: `${siteUrl}/case-studies/procurement-agent`,
    author: { "@type": "Organization", name: "CAPYN", url: siteUrl },
    about: ["AI agent authorization", "procurement agents", "human approval", "audit evidence"]
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />

      <section className="relative overflow-hidden border-b border-white/15 bg-code text-white">
        <div className="authority-field-dark pointer-events-none absolute inset-0 opacity-45" />
        <div className="site-container relative py-16 sm:py-24 lg:py-28">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/15 pb-5 font-mono text-[9px] uppercase tracking-[.16em] text-white/45">
            <p className="flex items-center gap-2 text-authority"><span className="h-1.5 w-1.5 rounded-full bg-authority" /> Boundary File 001</p>
            <p>Reference implementation · Synthetic data · Mock execution</p>
          </div>

          <div className="grid gap-12 pt-12 lg:grid-cols-[1.05fr_.95fr] lg:items-end">
            <div>
              <Eyebrow tone="authority">Procurement authority / human line</Eyebrow>
              <h1 className="display-title mt-7 max-w-4xl text-balance text-5xl font-semibold leading-[.93] tracking-[-.068em] sm:text-7xl">
                The <span className="text-authority">$120 request</span> that cannot cross alone.
              </h1>
              <p className="mt-8 max-w-2xl text-base leading-8 text-white/60 sm:text-lg">
                A procurement agent needs AWS capacity for a nightly evaluation. The vendor and capability are allowed. The amount is beneath the hard ceiling—but above the line where a person must decide.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href="#replay" className="public-primary-button min-h-12 justify-center border-white bg-white px-6 text-code">Replay the boundary <ArrowRight size={15} /></Link>
                <Link href="/start" className="inline-flex min-h-12 items-center justify-center border border-white/20 px-6 text-sm font-bold text-white">Build a different mandate</Link>
              </div>
            </div>

            <aside className="border border-white/20 bg-white/[.035]" aria-label="Authority comparison">
              <div className="flex items-center justify-between border-b border-white/15 px-5 py-4 font-mono text-[9px] uppercase tracking-[.14em] text-white/40">
                <span>Decision threshold</span><LockKeyhole size={14} className="text-review" />
              </div>
              <div className="grid items-center gap-3 p-6 sm:grid-cols-[1fr_auto_1fr] sm:p-8">
                <div><p className="font-mono text-[9px] uppercase tracking-[.13em] text-white/35">Exact request</p><p className="mono-number mt-2 text-4xl font-semibold tracking-[-.06em] text-white">$120</p></div>
                <span className="display-title text-3xl text-review" aria-label="is greater than">&gt;</span>
                <div><p className="font-mono text-[9px] uppercase tracking-[.13em] text-white/35">Human line</p><p className="mono-number mt-2 text-4xl font-semibold tracking-[-.06em] text-review">$100</p></div>
              </div>
              <div className="border-t border-review/35 bg-review/10 px-6 py-5 sm:px-8">
                <p className="font-mono text-[9px] uppercase tracking-[.15em] text-review">Consequence</p>
                <p className="display-title mt-2 text-2xl font-semibold tracking-[-.045em]">Human required. Nothing executes yet.</p>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-panel">
        <div className="site-container grid lg:grid-cols-[.72fr_1.28fr]">
          <div className="border-b border-line py-10 lg:border-b-0 lg:border-r lg:py-14 lg:pr-12">
            <p className="font-mono text-[9px] uppercase tracking-[.15em] text-authority">The brief / one consequence</p>
            <h2 className="display-title mt-5 text-3xl font-semibold tracking-[-.05em]">Provision compute without granting a standing blank cheque.</h2>
            <p className="mt-5 text-sm leading-7 text-muted">The reference agent may buy approved compute, but each action remains bound to a capability, vendor, amount and purpose.</p>
          </div>
          <dl className="grid sm:grid-cols-2 lg:pl-12">
            {mandateRows.map(([term, value], index) => (
              <div key={term} className={`border-b border-line px-0 py-5 sm:border-r sm:px-6 sm:odd:pl-0 sm:even:border-r-0 ${index < 2 ? "lg:pt-14" : ""}`}>
                <dt className="font-mono text-[8px] uppercase tracking-[.13em] text-muted">{term}</dt>
                <dd className="mono-number mt-2 text-sm font-bold">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section id="replay" className="site-section scroll-mt-20 bg-code text-white">
        <div className="site-container">
          <div className="grid gap-7 pb-10 lg:grid-cols-[.72fr_1.28fr] lg:items-end">
            <div>
              <Eyebrow tone="authority">Replay / live public mandate</Eyebrow>
              <h2 className="display-title mt-6 text-4xl font-semibold tracking-[-.058em] sm:text-5xl">Do not take the story on trust.</h2>
            </div>
            <div className="lg:border-l lg:border-white/15 lg:pl-10">
              <p className="max-w-2xl text-sm leading-7 text-white/[.58]">Run the original $120 request, lower it to $18, or choose a blocked capability. CAPYN evaluates the real public mandate and generates a receipt you can verify locally.</p>
            </div>
          </div>
          <AuthorityConsole />
        </div>
      </section>

      <section className="site-section border-b border-line">
        <div className="site-container grid gap-12 lg:grid-cols-[.68fr_1.32fr]">
          <div>
            <Eyebrow tone="permission">What the boundary changes</Eyebrow>
            <h2 className="display-title mt-6 text-4xl font-semibold tracking-[-.055em] sm:text-5xl">Approval becomes part of authorization—not a message after the fact.</h2>
            <p className="mt-6 text-base leading-8 text-muted">This reference file isolates the exact control CAPYN adds between an agent’s intent and the execution rail.</p>
          </div>
          <div className="border border-line bg-panel">
            <div className="grid border-b border-line sm:grid-cols-2">
              <div className="p-6 sm:border-r sm:border-line sm:p-8">
                <p className="font-mono text-[9px] uppercase tracking-[.14em] text-denial">Without the boundary</p>
                <div className="mt-6 space-y-4 text-sm leading-7 text-muted">
                  <p>The credential and the business intention are separate.</p>
                  <p>A human conversation may not bind to one exact request.</p>
                  <p>The decision record must be reconstructed afterward.</p>
                </div>
              </div>
              <div className="border-t border-line p-6 sm:border-t-0 sm:p-8">
                <p className="font-mono text-[9px] uppercase tracking-[.14em] text-permission">With CAPYN</p>
                <div className="mt-6 space-y-4 text-sm leading-7">
                  {["The mandate names what this agent may do.", "The $100 human line applies to one exact $120 action.", "The outcome ships with reasons and ordered evidence."].map((item) => <p key={item} className="flex gap-3"><Check size={14} className="mt-1.5 shrink-0 text-permission" />{item}</p>)}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-5 text-xs leading-6 text-muted sm:p-6"><ShieldCheck size={16} className="mt-1 shrink-0 text-authority" /><p>This is a synthetic reference implementation, not a customer deployment claim. Policy evaluation and receipt generation are live; execution remains mocked and no funds move.</p></div>
          </div>
        </div>
      </section>

      <section className="site-section bg-panel">
        <div className="site-container">
          <div className="flex flex-col justify-between gap-6 border-b border-line pb-8 sm:flex-row sm:items-end">
            <div><Eyebrow>Evidence sequence</Eyebrow><h2 className="display-title mt-5 text-4xl font-semibold tracking-[-.055em]">One action. Four durable transitions.</h2></div>
            <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[.13em] text-muted"><FileCheck2 size={14} className="text-authority" /> SHA-256 verifiable</div>
          </div>
          <ol className="grid lg:grid-cols-4">
            {evidenceSequence.map(([title, copy], index) => (
              <li key={title} className="relative border-b border-line py-7 lg:border-b-0 lg:border-r lg:px-6 lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0">
                <div className="flex items-center justify-between"><span className="font-mono text-[9px] text-authority">{String(index + 1).padStart(2, "0")}</span>{index === 0 ? <Fingerprint size={15} className="text-muted" /> : index === evidenceSequence.length - 1 ? <FileCheck2 size={15} className="text-muted" /> : <span className="h-px w-8 bg-line" />}</div>
                <h3 className="mt-8 text-sm font-extrabold">{title}</h3>
                <p className="mt-3 text-xs leading-6 text-muted">{copy}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10"><TextLink href="/proof">Open the proof viewer</TextLink></div>
        </div>
      </section>

      <PublicCta />
    </main>
  );
}
