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
              <h1 className="display-title"><span>Bring one action</span><em>worth controlling.</em></h1>
              <p className="partner-hero__lede">
                Pick the agent action where a mistake costs money, access or trust. We turn it into an identity-bound mandate, a deterministic decision path and evidence your team can inspect.
              </p>
              <div className="partner-hero__actions">
                <Link href="/design-partners/brief" className="partner-button partner-button--primary">
                  Draft a private brief <ArrowRight size={15} />
                </Link>
                <a href={applicationUrl} target="_blank" rel="noreferrer" className="partner-button partner-button--secondary">
                  Use the public brief <ExternalLink size={15} />
                </a>
              </div>
              <p className="partner-public-note">
                <ShieldCheck size={14} /> The private builder uploads nothing and creates a portable draft. The GitHub route remains public and must contain no confidential information.
              </p>
            </div>

            <aside className="boundary-brief" aria-label="Example boundary brief">
              <div className="boundary-brief__head">
                <div>
                  <span>CAPYN / CANDIDATE BOUNDARY</span>
                  <strong>AWS evaluation capacity</strong>
                </div>
                <span className="boundary-brief__status"><span /> HUMAN REQUIRED</span>
              </div>
              <div className="boundary-brief__body">
                <div className="boundary-brief__identity">
                  <Fingerprint size={17} />
                  <div><span>Requesting identity</span><strong>nightly-evaluation-agent</strong></div>
                  <LockKeyhole size={14} />
                </div>
                <dl>
                  <div><dt>Exact action</dt><dd>Provision $120 of AWS evaluation capacity</dd></div>
                  <div><dt>Capability</dt><dd><code>spend.compute</code> · AWS only</dd></div>
                  <div><dt>Hard boundary</dt><dd>Deny above $150—even after approval</dd></div>
                  <div><dt>Human line</dt><dd>Require one request-bound approval above $100</dd></div>
                </dl>
                <div className="boundary-brief__outcome">
                  <span>DETERMINISTIC OUTCOME</span>
                  <p>REQUIRE_APPROVAL · no execution occurred</p>
                </div>
              </div>
              <div className="boundary-brief__foot">
                <span>IDENTITY</span><span>MANDATE</span><span>DECISION</span><span>EVIDENCE</span>
              </div>
            </aside>
          </div>

          <dl className="partner-hero__proofline" aria-label="Design partner engagement at a glance">
            <div><dt>Scope</dt><dd>One exact action</dd></div>
            <div><dt>Shape</dt><dd>8–12 focused weeks</dd></div>
            <div><dt>Starting</dt><dd>$1,000 / month</dd></div>
            <div><dt>First boundary</dt><dd>Synthetic execution</dd></div>
          </dl>
        </div>
      </section>

      <section className="partner-method">
        <div className="site-container">
          <div className="partner-section-intro">
            <p>THE ENGAGEMENT / ONE CONSEQUENCE</p>
            <h2 className="display-title">From one request to an enforceable boundary.</h2>
            <span>We start with the thing the agent is trying to do. Every workshop and implementation choice must tighten or prove that decision.</span>
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

          <div className="partner-output">
            <div><p>FIRST SCOPED OUTCOME</p><strong>A boundary your team can run, inspect and challenge.</strong></div>
            <div>
              <span><Fingerprint size={16} /><strong>Identity map</strong><small>Who is asking and which credential proves it.</small></span>
              <span><ShieldCheck size={16} /><strong>Working mandate</strong><small>Capabilities, limits, counterparties and human line.</small></span>
              <span><Check size={16} /><strong>Evidence path</strong><small>Decision trace and gaps before production execution.</small></span>
            </div>
          </div>
        </div>
      </section>

      <section className="partner-fit">
        <div className="site-container partner-fit__grid">
          <div className="partner-fit__statement">
            <p>FIT CHECK / BEFORE THE CALL</p>
            <h2 className="display-title">Bring an action—not an AI strategy deck.</h2>
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
            <h2 className="display-title">Small scope. Founder attention. Useful proof.</h2>
          </div>
          <div className="partner-commercial__terms">
            <p><strong>From $1,000</strong><span>USD / month</span></p>
            <span>Each 8–12 week engagement is scoped manually around one consequential action. The programme is for integration discovery and product-shaping work; acceptance, production readiness and delivery dates are not implied by an application.</span>
            <ul>
              <li><Check size={13} /> One named agent action and accountable owner</li>
              <li><Check size={13} /> Working sessions against real integration constraints</li>
              <li><Check size={13} /> Written boundary, evidence path and production gaps</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="partner-close">
        <div className="partner-close__seam" aria-hidden="true" />
        <div className="site-container partner-close__grid">
          <div>
            <p>YOUR NEXT REQUEST / HUMAN REQUIRED</p>
            <h2 className="display-title">Bring the action. We’ll draw the line.</h2>
          </div>
          <div className="partner-close__action">
            <p>Not a generic sales call. A structured, non-confidential architecture brief around one real boundary.</p>
            <Link href="/design-partners/brief" className="partner-button partner-button--light">
              Draft the private brief <ArrowRight size={15} />
            </Link>
            <Link href="/lab" className="partner-close__secondary">Test CAPYN in the public Lab <ArrowRight size={14} /></Link>
            <span>Browser-local · no account · no upload · review before sending</span>
          </div>
        </div>
      </section>
    </main>
  );
}
