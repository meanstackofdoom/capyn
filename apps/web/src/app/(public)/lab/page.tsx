import Link from "next/link";
import { ArrowRight, Braces, Fingerprint, ShieldCheck } from "lucide-react";
import { AuthorityLab } from "@/components/public/authority-lab";
import { Eyebrow } from "@/components/public/marketing-primitives";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Authority Lab",
  path: "/lab",
  description: "Compose a synthetic agent action and watch CAPYN allow it, deny it, or bind it to an exact human approval using the real deterministic policy engine.",
  keywords: ["AI agent authorization demo", "agent policy engine", "human approval workflow", "agent authority lab"]
});

const proof = [
  {
    number: "01",
    title: "The identity is server-bound.",
    copy: "The visitor controls the intent—not the requesting agent, mandate, limits, or observed spend. Those stay on the trusted side of the boundary.",
    icon: Fingerprint
  },
  {
    number: "02",
    title: "Hard failure stays failed.",
    copy: "An approval can satisfy the human threshold. It cannot override an ungranted capability, an unknown vendor, or a hard spending ceiling.",
    icon: ShieldCheck
  },
  {
    number: "03",
    title: "The receipt leaves the lab.",
    copy: "Replay every actor and transition, recompute the SHA-256 digest locally, download the JSON, print it, or share a client-side proof link.",
    icon: Braces
  }
] as const;

export default function LabPage() {
  return (
    <main className="lab-page">
      <section className="lab-hero">
        <div className="lab-hero__grid" aria-hidden="true" />
        <div className="site-container lab-hero__shell">
          <div className="lab-hero__intro">
            <div>
              <Eyebrow tone="permission">Authority Lab / live policy logic</Eyebrow>
              <h1 className="display-title">Try to cross<br /><em>the line.</em></h1>
            </div>
            <div className="lab-hero__brief">
              <p>Compose an agent action. CAPYN will let it through, stop it cold, or hold that exact request for a human.</p>
              <dl>
                <div><dt>Engine</dt><dd>Real evaluator</dd></div>
                <div><dt>Money</dt><dd>Synthetic USD</dd></div>
                <div><dt>Storage</dt><dd>Ephemeral</dd></div>
              </dl>
            </div>
          </div>

          <AuthorityLab />

          <div className="lab-hero__footnote">
            <span>PUBLIC LAB / v0.2</span>
            <p>This instrument cannot reach customer data, payment rails, or production credentials.</p>
          </div>
        </div>
      </section>

      <section className="site-section bg-panel">
        <div className="site-container">
          <div className="lab-afterword">
            <p className="font-mono text-[10px] uppercase tracking-[.17em] text-authority">What the lab proves</p>
            <h2 className="display-title">Authority is not a dashboard setting.<br />It is the moment before consequence.</h2>
          </div>
          <div className="lab-proof">
            {proof.map(({ number, title, copy, icon: Icon }) => (
              <article key={number}>
                <div><span>{number}</span><Icon size={17} /></div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lab-handoff">
        <div className="site-container lab-handoff__inner">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.17em] text-white/50">From synthetic to specific</p>
            <h2 className="display-title">Now bring the boundary that matters.</h2>
          </div>
          <div className="lab-handoff__actions">
            <Link href="/start" className="public-primary-button">Build this boundary <ArrowRight size={15} /></Link>
            <Link href="/developers" className="public-secondary-button">Integrate CAPYN <ArrowRight size={15} /></Link>
          </div>
        </div>
      </section>
    </main>
  );
}
