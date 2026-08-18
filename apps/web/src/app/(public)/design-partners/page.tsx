import Link from "next/link";
import { ArrowRight, Check, ExternalLink, Fingerprint, LockKeyhole, ShieldCheck, X } from "lucide-react";
import { createPageMetadata } from "@/lib/metadata";

const applicationUrl = "https://github.com/meanstackofdoom/capyn/issues/new?template=design-partner.yml";

export const metadata = createPageMetadata({
  title: "Design partners",
  path: "/design-partners",
  description: "Bring CAPYN one consequential agent action and shape a bounded authority path around its identity, limits, human intervention and evidence.",
  keywords: ["AI agent design partner", "agent authorization architecture", "agent governance prototype", "human in the loop agents"]
});

const boundarySequence = [
  {
    signal: "REQUEST",
    title: "Name one exact action.",
    copy: "Start with the consequential thing the agent wants to do—not a broad platform brief."
  },
  {
    signal: "MANDATE",
    title: "Draw its hard limits.",
    copy: "Bind identity, capability, counterparty, amount, time and usage to explicit rules."
  },
  {
    signal: "HUMAN",
    title: "Place intervention on purpose.",
    copy: "Define when a person must approve, what they see and exactly what that approval unlocks."
  },
  {
    signal: "EVIDENCE",
    title: "Prove the consequence.",
    copy: "Return a deterministic outcome and preserve the decision sequence a team can inspect later."
  }
] as const;

const goodSignals = [
  "A repeatable agent action already exists or is being prototyped.",
  "There is a real consequence when the action is wrong.",
  "A human owner can define the boundary and review edge cases.",
  "The first pass can run with synthetic data and mock execution."
] as const;

const tooEarly = [
  "The action is still described only as “use AI in our product.”",
  "CAPYN would be expected to custody funds or replace the execution rail.",
  "The project needs a production certification or SLA before discovery.",
  "The initial conversation cannot begin with a non-confidential summary."
] as const;

export default function DesignPartnersPage() {
  return (
    <main className="partner-page">
      <section className="partner-hero">
        <div className="partner-hero__rules" aria-hidden="true" />
        <div className="site-container partner-hero__shell">
          <div className="partner-hero__meta">
            <p><span className="partner-signal" /> Design partner programme / selective</p>
            <p>CAPYN · PUBLIC ALPHA · 2026</p>
          </div>

          <div className="partner-hero__grid">
            <div className="partner-hero__thesis">
              <h1 className="display-title">Bring one real <em>boundary.</em></h1>
              <p className="partner-hero__lede">
                Choose the consequential action your agent must earn the right to take. We will map the identity, mandate, hard stops, human intervention and evidence around it.
              </p>
              <div className="partner-hero__actions">
                <a href={applicationUrl} target="_blank" rel="noreferrer" className="partner-button partner-button--primary">
                  Start a boundary brief <ExternalLink size={15} />
                </a>
                <Link href="/lab" className="partner-button partner-button--secondary">
                  Rehearse in the Lab <ArrowRight size={15} />
                </Link>
              </div>
              <p className="partner-public-note">
                <ShieldCheck size={14} /> The opening brief is a public GitHub issue. Keep it non-confidential; detailed architecture moves to a private channel only if there is a fit.
              </p>
            </div>

            <aside className="boundary-brief" aria-label="Example boundary brief">
              <div className="boundary-brief__head">
                <div>
                  <span>CAPYN / BOUNDARY BRIEF</span>
                  <strong>Pre-flight record</strong>
                </div>
                <span className="boundary-brief__status"><span /> UNBOUND</span>
              </div>
              <div className="boundary-brief__body">
                <div className="boundary-brief__identity">
                  <Fingerprint size={17} />
                  <div><span>Requesting system</span><strong>Your autonomous agent</strong></div>
                  <LockKeyhole size={14} />
                </div>
                <dl>
                  <div><dt>Exact action</dt><dd>The one request that carries consequence</dd></div>
                  <div><dt>Hard boundary</dt><dd>What approval must never override</dd></div>
                  <div><dt>Human line</dt><dd>Who can release one exact request</dd></div>
                  <div><dt>Proof</dt><dd>What survives after the decision</dd></div>
                </dl>
                <div className="boundary-brief__outcome">
                  <span>DESIRED OUTCOME</span>
                  <p>An agent that can explain why it acted—or why it stopped.</p>
                </div>
              </div>
              <div className="boundary-brief__foot">
                <span>IDENTITY</span><span>MANDATE</span><span>DECISION</span><span>EVIDENCE</span>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="partner-method">
        <div className="site-container">
          <div className="partner-section-intro">
            <p>THE ENGAGEMENT / ONE CONSEQUENCE</p>
            <h2 className="display-title">Turn a fuzzy autonomy problem into an enforceable decision path.</h2>
            <span>We work from the action backwards. The boundary comes before dashboards, integrations or infrastructure promises.</span>
          </div>

          <div className="partner-sequence" role="list" aria-label="Design partner sequence">
            {boundarySequence.map((step, index) => (
              <article key={step.signal} className="partner-sequence__step" role="listitem">
                <div className="partner-sequence__marker"><span>{String(index + 1).padStart(2, "0")}</span><i /></div>
                <p>{step.signal}</p>
                <h3>{step.title}</h3>
                <span>{step.copy}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="partner-fit">
        <div className="site-container partner-fit__grid">
          <div className="partner-fit__statement">
            <p>FIT CHECK / BEFORE THE CALL</p>
            <h2 className="display-title">Specific beats impressive.</h2>
            <span>
              “Let an agent provision $120 of AWS capacity for a nightly evaluation” is useful. “Help us govern AI” is not ready yet.
            </span>
          </div>

          <div className="partner-fit__ledger">
            <div className="partner-fit__column partner-fit__column--good">
              <div><span>GOOD SIGNAL</span><Check size={17} /></div>
              {goodSignals.map((item) => <p key={item}><Check size={13} />{item}</p>)}
            </div>
            <div className="partner-fit__column partner-fit__column--early">
              <div><span>TOO EARLY</span><X size={17} /></div>
              {tooEarly.map((item) => <p key={item}><X size={13} />{item}</p>)}
            </div>
          </div>
        </div>
      </section>

      <section className="partner-commercial">
        <div className="site-container partner-commercial__grid">
          <div>
            <p>COMMERCIAL SHAPE / MANUAL AGREEMENT</p>
            <h2 className="display-title">Founder-led, tightly scoped, deliberately early.</h2>
          </div>
          <div className="partner-commercial__terms">
            <p><strong>From $1,000</strong><span>USD / month</span></p>
            <span>Each 8–12 week engagement is scoped manually around one consequential action. The programme is for integration discovery and product-shaping work; acceptance, production readiness and delivery dates are not implied by an application.</span>
          </div>
        </div>
      </section>

      <section className="partner-close">
        <div className="partner-close__seam" aria-hidden="true" />
        <div className="site-container partner-close__grid">
          <div>
            <p>YOUR NEXT REQUEST / HUMAN REQUIRED</p>
            <h2 className="display-title">Show us the action your agent must earn.</h2>
          </div>
          <div className="partner-close__action">
            <p>Not a generic sales call. A structured, non-confidential architecture brief around one real boundary.</p>
            <a href={applicationUrl} target="_blank" rel="noreferrer" className="partner-button partner-button--light">
              Open the boundary brief <ExternalLink size={15} />
            </a>
            <span>GitHub account required · public issue · no secrets or customer data</span>
          </div>
        </div>
      </section>
    </main>
  );
}
