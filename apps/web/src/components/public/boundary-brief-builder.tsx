"use client";

import Link from "next/link";
import {
  ArrowRight,
  Check,
  Clipboard,
  Download,
  ExternalLink,
  FileLock2,
  Mail,
  RotateCcw,
  ShieldCheck
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  BOUNDARY_HUMAN_OPTIONS,
  BOUNDARY_STAGE_OPTIONS,
  boundaryBriefFilename,
  createBoundaryBriefMailto,
  createBoundaryBriefMarkdown,
  type BoundaryBriefDraft,
  type BoundaryBriefErrors,
  type BoundaryBriefField,
  validateBoundaryBrief
} from "@/lib/boundary-brief";

const applicationUrl = "https://github.com/meanstackofdoom/capyn/issues/new?template=design-partner.yml";

const initialDraft: BoundaryBriefDraft = {
  organisation: "",
  stage: "Internal or sandbox workflow",
  action: "",
  consequence: "",
  humanLine: "Manual approval outside the product",
  executionContext: "",
  usefulOutcome: ""
};

interface BoundaryBriefBuilderProps {
  contactEmail: string | null;
}

function countText(value: string, maximum: number): string {
  return String(value.length) + "/" + maximum;
}

export function BoundaryBriefBuilder({ contactEmail }: BoundaryBriefBuilderProps) {
  const [draft, setDraft] = useState<BoundaryBriefDraft>(initialDraft);
  const [errors, setErrors] = useState<BoundaryBriefErrors>({});
  const [status, setStatus] = useState("Draft not stored or submitted.");

  const completedCoreFields = useMemo(() => [
    draft.action.trim().length >= 20,
    draft.consequence.trim().length >= 20,
    draft.usefulOutcome.trim().length >= 20
  ].filter(Boolean).length, [draft.action, draft.consequence, draft.usefulOutcome]);

  function update<Field extends BoundaryBriefField>(field: Field, value: BoundaryBriefDraft[Field]): void {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setStatus("Draft changed locally.");
  }

  function validateForTransfer(): boolean {
    const nextErrors = validateBoundaryBrief(draft);
    setErrors(nextErrors);
    const firstField = Object.keys(nextErrors)[0] as BoundaryBriefField | undefined;
    if (firstField) {
      setStatus("Complete the marked fields before transfer.");
      window.requestAnimationFrame(() => document.getElementById("brief-" + firstField)?.focus());
      return false;
    }
    return true;
  }

  async function copyBrief(): Promise<void> {
    if (!validateForTransfer()) return;
    try {
      await navigator.clipboard.writeText(createBoundaryBriefMarkdown(draft));
      setStatus("Private brief copied. Review it before sending.");
    } catch {
      setStatus("Copy failed. Download the Markdown brief instead.");
    }
  }

  function downloadBrief(): void {
    if (!validateForTransfer()) return;
    const blob = new Blob([createBoundaryBriefMarkdown(draft)], { type: "text/markdown;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = boundaryBriefFilename(draft.organisation);
    anchor.click();
    window.URL.revokeObjectURL(url);
    setStatus("Private Markdown brief downloaded.");
  }

  function openPrivateEmail(): void {
    if (!contactEmail || !validateForTransfer()) return;
    window.location.href = createBoundaryBriefMailto(contactEmail, draft);
    setStatus("Private email draft opened in your mail application.");
  }

  function clearDraft(): void {
    setDraft(initialDraft);
    setErrors({});
    setStatus("Browser-local draft cleared.");
  }

  return (
    <main className="brief-page">
      <section className="brief-intro">
        <div className="brief-intro__field" aria-hidden="true" />
        <div className="site-container brief-intro__grid">
          <div>
            <p className="brief-kicker"><span /> Boundary desk / browser-local</p>
            <h1 className="display-title">Make the first conversation useful <em>before it becomes confidential.</em></h1>
          </div>
          <aside className="brief-intro__notice">
            <FileLock2 size={18} />
            <p><strong>Nothing here is uploaded.</strong> This page keeps the draft in memory only. Refresh or leave and it disappears.</p>
          </aside>
        </div>
      </section>

      <section className="site-container brief-workbench" aria-label="Private boundary brief builder">
        <form
          className="brief-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (contactEmail) openPrivateEmail();
            else void copyBrief();
          }}
        >
          <div className="brief-form__head">
            <div>
              <p>INPUT / ONE CONSEQUENCE</p>
              <h2 className="display-title">Draw the boundary.</h2>
            </div>
            <span>{completedCoreFields}/3 core fields</span>
          </div>

          <div className="brief-form__section">
            <p className="brief-form__section-label">01 / Context</p>
            <label className="brief-field" htmlFor="brief-organisation">
              <span>Organisation or project <small>Optional</small></span>
              <input
                id="brief-organisation"
                autoComplete="organization"
                maxLength={120}
                value={draft.organisation}
                onChange={(event) => update("organisation", event.target.value)}
                placeholder="Example Labs"
                aria-invalid={Boolean(errors.organisation)}
                aria-describedby={errors.organisation ? "brief-organisation-error" : undefined}
              />
              <small>{countText(draft.organisation, 120)}</small>
              {errors.organisation && <em id="brief-organisation-error">{errors.organisation}</em>}
            </label>

            <label className="brief-field" htmlFor="brief-stage">
              <span>Current delivery stage</span>
              <select id="brief-stage" value={draft.stage} onChange={(event) => update("stage", event.target.value as BoundaryBriefDraft["stage"])}>
                {BOUNDARY_STAGE_OPTIONS.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
          </div>

          <div className="brief-form__section">
            <p className="brief-form__section-label">02 / Consequence</p>
            <label className="brief-field" htmlFor="brief-action">
              <span>One exact action</span>
              <textarea
                id="brief-action"
                maxLength={240}
                value={draft.action}
                onChange={(event) => update("action", event.target.value)}
                placeholder="Allow the procurement agent to provision approved inference capacity for a nightly evaluation."
                aria-invalid={Boolean(errors.action)}
                aria-describedby={errors.action ? "brief-action-error" : "brief-action-hint"}
              />
              <small id="brief-action-hint">Describe the request, not the whole AI programme. {countText(draft.action, 240)}</small>
              {errors.action && <em id="brief-action-error">{errors.action}</em>}
            </label>

            <label className="brief-field" htmlFor="brief-consequence">
              <span>Consequence and hard stop</span>
              <textarea
                id="brief-consequence"
                maxLength={360}
                value={draft.consequence}
                onChange={(event) => update("consequence", event.target.value)}
                placeholder="The request must stop for an unapproved vendor or above the hard ceiling, even after human review."
                aria-invalid={Boolean(errors.consequence)}
                aria-describedby={errors.consequence ? "brief-consequence-error" : "brief-consequence-hint"}
              />
              <small id="brief-consequence-hint">Name what approval must never override. {countText(draft.consequence, 360)}</small>
              {errors.consequence && <em id="brief-consequence-error">{errors.consequence}</em>}
            </label>
          </div>

          <div className="brief-form__section">
            <p className="brief-form__section-label">03 / Handoff</p>
            <label className="brief-field" htmlFor="brief-humanLine">
              <span>Current human checkpoint</span>
              <select id="brief-humanLine" value={draft.humanLine} onChange={(event) => update("humanLine", event.target.value as BoundaryBriefDraft["humanLine"])}>
                {BOUNDARY_HUMAN_OPTIONS.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>

            <label className="brief-field" htmlFor="brief-executionContext">
              <span>Execution context <small>Optional</small></span>
              <textarea
                id="brief-executionContext"
                maxLength={240}
                value={draft.executionContext}
                onChange={(event) => update("executionContext", event.target.value)}
                placeholder="AWS API, Stripe, Solana, an internal service, or another execution rail."
                aria-invalid={Boolean(errors.executionContext)}
              />
              <small>{countText(draft.executionContext, 240)}</small>
              {errors.executionContext && <em>{errors.executionContext}</em>}
            </label>

            <label className="brief-field" htmlFor="brief-usefulOutcome">
              <span>Smallest useful outcome</span>
              <textarea
                id="brief-usefulOutcome"
                maxLength={300}
                value={draft.usefulOutcome}
                onChange={(event) => update("usefulOutcome", event.target.value)}
                placeholder="A reviewed mandate and synthetic authorization path we can replay against our agent."
                aria-invalid={Boolean(errors.usefulOutcome)}
                aria-describedby={errors.usefulOutcome ? "brief-outcome-error" : undefined}
              />
              <small>{countText(draft.usefulOutcome, 300)}</small>
              {errors.usefulOutcome && <em id="brief-outcome-error">{errors.usefulOutcome}</em>}
            </label>
          </div>

          <div className="brief-form__actions">
            {contactEmail ? (
              <button type="submit" className="brief-button brief-button--primary">
                <Mail size={15} /> Open private email <ArrowRight size={14} />
              </button>
            ) : (
              <button type="submit" className="brief-button brief-button--primary">
                <Clipboard size={15} /> Copy private brief <ArrowRight size={14} />
              </button>
            )}
            <button type="button" className="brief-button" onClick={downloadBrief}><Download size={15} /> Download .md</button>
            <button type="button" className="brief-button brief-button--quiet" onClick={clearDraft}><RotateCcw size={14} /> Clear</button>
          </div>
          <p className="brief-form__status" aria-live="polite">{status}</p>
        </form>

        <aside className="brief-document" aria-label="Live boundary brief preview">
          <div className="brief-document__tape" aria-hidden="true">PRIVATE DRAFT · PRIVATE DRAFT · PRIVATE DRAFT ·</div>
          <header>
            <div>
              <span>CAPYN / BOUNDARY BRIEF</span>
              <strong>BD-LOCAL-0001</strong>
            </div>
            <p><span /> BROWSER ONLY</p>
          </header>

          <div className="brief-document__identity">
            <span>Organisation / project</span>
            <h2 className="display-title">{draft.organisation.trim() || "Undisclosed team"}</h2>
            <p>{draft.stage}</p>
          </div>

          <section className="brief-document__block brief-document__block--action">
            <span>One exact consequential action</span>
            <p>{draft.action.trim() || "Name the action the agent must earn the right to take."}</p>
          </section>

          <div className="brief-document__split">
            <section>
              <span>Hard stop</span>
              <p>{draft.consequence.trim() || "Define what a human approval must never override."}</p>
            </section>
            <section>
              <span>Human line</span>
              <p>{draft.humanLine}</p>
            </section>
          </div>

          <section className="brief-document__block">
            <span>Execution context</span>
            <p>{draft.executionContext.trim() || "Not supplied"}</p>
          </section>

          <section className="brief-document__block brief-document__block--outcome">
            <span>Smallest useful outcome</span>
            <p>{draft.usefulOutcome.trim() || "Describe the smallest boundary worth proving."}</p>
          </section>

          <div className="brief-document__seam" aria-hidden="true"><span>SEALED IN BROWSER MEMORY</span></div>

          <div className="brief-document__handling">
            <p><ShieldCheck size={14} /><span><strong>Not submitted.</strong> CAPYN receives none of these fields from this page.</span></p>
            <p><Check size={14} /><span><strong>Not persisted.</strong> No local storage, account or server record is created.</span></p>
            <p><FileLock2 size={14} /><span><strong>Review before sending.</strong> Never include credentials, keys, payment details or customer data.</span></p>
          </div>

          <footer>
            <span>{contactEmail ? "PRIVATE EMAIL / AVAILABLE" : "OWNER ADDRESS / NOT PUBLISHED"}</span>
            <strong>boundary-brief/v1</strong>
          </footer>
        </aside>
      </section>

      <section className="brief-transfer">
        <div className="site-container brief-transfer__grid">
          <div>
            <p>TRANSFER / YOU CHOOSE THE CHANNEL</p>
            <h2 className="display-title">Keep private context private.</h2>
          </div>
          <div>
            <p>
              {contactEmail
                ? "The email action opens your own mail client with the brief prefilled. CAPYN still does not receive the draft from this page."
                : "CAPYN has not published an owner-approved contact address yet. Copy or download the brief now; the final private channel can be attached without rebuilding this workflow."}
            </p>
            <div className="brief-transfer__links">
              <a href={applicationUrl} target="_blank" rel="noreferrer">Use the public GitHub brief <ExternalLink size={13} /></a>
              <Link href="/lab">Rehearse a synthetic request <ArrowRight size={13} /></Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
