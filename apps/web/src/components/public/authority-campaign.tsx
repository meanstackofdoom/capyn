import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

const stages = [
  {
    id: "intent",
    number: "01",
    label: "Intent",
    title: "What the agent wants.",
    copy: "One typed request moves toward the point of consequence. Nothing has been permitted yet.",
    state: "STATE / UNDECIDED",
    image: "/images/campaign/authority-intent.webp",
    alt: "Cobalt glass request object approaching a narrow amber authority boundary."
  },
  {
    id: "boundary",
    number: "02",
    label: "Authority",
    title: "The boundary answers.",
    copy: "Capabilities, hard limits and human thresholds meet the exact request before execution.",
    state: "STATE / ALLOW · DENY · REVIEW",
    image: "/images/campaign/authority-boundary.webp",
    alt: "Cobalt glass request object held immediately before an amber authority boundary."
  },
  {
    id: "evidence",
    number: "03",
    label: "Evidence",
    title: "The outcome remains.",
    copy: "The decision, reasons and policy trace survive the moment that produced them.",
    state: "STATE / INSPECTABLE",
    image: "/images/campaign/authority-evidence.webp",
    alt: "Cobalt request object preserved inside a layered transparent evidence archive."
  }
] as const;

export function AuthorityCampaign() {
  return (
    <section className="authority-campaign" aria-labelledby="authority-campaign-title">
      <div className="authority-campaign__field" aria-hidden="true" />
      <div className="site-container authority-campaign__shell">
        <header className="authority-campaign__header">
          <p className="authority-campaign__eyebrow"><span /> CAPYN object study / 001</p>
          <div className="authority-campaign__statement">
            <h2 id="authority-campaign-title" className="display-title authority-campaign__title">
              Every autonomous action has <em>a moment before consequence.</em>
            </h2>
            <div className="authority-campaign__intro">
              <p>CAPYN turns that invisible interval into something a team can inspect: intent enters, authority decides, evidence remains.</p>
              <div className="authority-campaign__formula" aria-label="Intent, then authority, then evidence">
                <span>Intent</span><i aria-hidden="true" /><span>Authority</span><i aria-hidden="true" /><span>Evidence</span>
              </div>
            </div>
          </div>
        </header>

        <ol className="authority-campaign__sequence">
          {stages.map((stage) => (
            <li key={stage.id} className={`authority-campaign__stage authority-campaign__stage--${stage.id}`}>
              <figure>
                <div className="authority-campaign__visual">
                  <Image
                    src={stage.image}
                    alt={stage.alt}
                    fill
                    quality={90}
                    sizes="(max-width: 760px) calc(100vw - 2.5rem), (max-width: 1280px) 75vw, 960px"
                    className="authority-campaign__image"
                  />
                  <span className="authority-campaign__image-number" aria-hidden="true">{stage.number}</span>
                  <span className="authority-campaign__image-data" aria-hidden="true">CAPYN / AUTHORITY OBJECT</span>
                </div>
                <figcaption className="authority-campaign__caption">
                  <div className="authority-campaign__caption-top">
                    <span>{stage.number}</span>
                    <span>{stage.label}</span>
                  </div>
                  <h3 className="display-title">{stage.title}</h3>
                  <p>{stage.copy}</p>
                  <code>{stage.state}</code>
                </figcaption>
              </figure>
            </li>
          ))}
        </ol>

        <div className="authority-campaign__handoff">
          <p><span>Next / make it real</span>Watch one request cross the boundary.</p>
          <div className="authority-campaign__actions">
            <Link href="/lab">Run the sequence <ArrowRight size={15} /></Link>
            <Link href="/design-partners">Bring your boundary</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
