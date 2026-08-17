"use client";

import Link from "next/link";
import { ArrowRight, Braces, Check, ChevronDown, Clipboard, FileCheck2, Link2, LockKeyhole, ShieldCheck, X } from "lucide-react";
import { useState, type CSSProperties } from "react";
import {
  PUBLIC_DEMO_APPROVAL_THRESHOLD,
  PUBLIC_DEMO_HARD_LIMIT,
  PUBLIC_DEMO_MAX_AMOUNT,
  createDemoRequest,
  createLabHandoffHref,
  demoActions,
  evaluateDemoRequest,
  formatDemoMoney,
  getDemoAction,
  getDemoVendor,
  type DemoActionId,
  type DemoRuleState,
  type DemoVendorState
} from "@/lib/demo-authority";

const ruleLabels: Record<DemoRuleState, string> = {
  pass: "Passed",
  fail: "Failed",
  review: "Review",
  skipped: "Skipped"
};

const ruleGlyphs: Record<DemoRuleState, string> = {
  pass: "✓",
  fail: "×",
  review: "!",
  skipped: "—"
};

type CopyTarget = "link" | "request" | null;

export function DelegatedEnvelope() {
  const [actionId, setActionId] = useState<DemoActionId>("compute");
  const [vendorState, setVendorState] = useState<DemoVendorState>("approved");
  const [amount, setAmount] = useState(120);
  const [copied, setCopied] = useState<CopyTarget>(null);

  const action = getDemoAction(actionId);
  const vendor = getDemoVendor(actionId, vendorState);
  const request = createDemoRequest(actionId, vendorState, amount);
  const evaluation = evaluateDemoRequest(actionId, vendorState, amount);
  const labHref = createLabHandoffHref(request, "homepage");
  const requestId = `demo_${action.id}_${vendor.id}_${amount}`;
  const requestPayload = JSON.stringify({
    mode: "SYNTHETIC",
    mandate: "procurement-v3",
    request,
    predictedDecision: evaluation.decision,
    reason: evaluation.reason
  }, null, 2);

  const approvalPosition = (PUBLIC_DEMO_APPROVAL_THRESHOLD / PUBLIC_DEMO_MAX_AMOUNT) * 100;
  const hardPosition = (PUBLIC_DEMO_HARD_LIMIT / PUBLIC_DEMO_MAX_AMOUNT) * 100;
  const requestPosition = Math.min((amount / PUBLIC_DEMO_MAX_AMOUNT) * 100, 100);
  const ResultIcon = evaluation.decision === "ALLOW" ? Check : evaluation.decision === "DENY" ? X : LockKeyhole;
  const envelopeStyle = {
    "--envelope-approval": `${approvalPosition}%`,
    "--envelope-hard": `${hardPosition}%`,
    "--envelope-request": `${requestPosition}%`
  } as CSSProperties;

  async function copyText(target: Exclude<CopyTarget, null>, value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(target);
      window.setTimeout(() => setCopied(null), 1_800);
    } catch {
      setCopied(null);
    }
  }

  function copyShareLink(): void {
    const shareUrl = new URL(labHref, window.location.origin).toString();
    void copyText("link", shareUrl);
  }

  return (
    <section id="delegated-envelope" className={`delegated-envelope delegated-envelope--${evaluation.tone}`} aria-labelledby="delegated-envelope-title">
      <div className="delegated-envelope__field" aria-hidden="true" />
      <div className="site-container delegated-envelope__shell">
        <header className="delegated-envelope__header">
          <p className="delegated-envelope__eyebrow"><span /> Live authority proof / public mandate v3</p>
          <div className="delegated-envelope__intro">
            <h2 id="delegated-envelope-title" className="display-title">Move one request. <em>Watch authority answer.</em></h2>
            <p>Change the capability, vendor policy or amount. The preview uses the same fixed mandate as the public Authority Lab.</p>
          </div>
        </header>

        <div className="delegated-envelope__instrument">
          <aside className="delegated-envelope__controls" aria-label="Authorization request controls">
            <div className="delegated-envelope__control">
              <div className="delegated-envelope__control-label"><span>Capability</span><code>01</code></div>
              <div className="delegated-envelope__choices" aria-label="Capability">
                {demoActions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={action.id === item.id}
                    onClick={() => {
                      setActionId(item.id);
                      setAmount(item.initialAmount);
                    }}
                  >
                    <span>{item.label}</span><code>{item.capability}</code>
                  </button>
                ))}
              </div>
            </div>

            <div className="delegated-envelope__control">
              <div className="delegated-envelope__control-label"><span>Vendor policy</span><code>02</code></div>
              <div className="delegated-envelope__vendor" aria-label="Vendor policy">
                <button type="button" aria-pressed={vendorState === "approved"} onClick={() => setVendorState("approved")}><Check size={13} /> Approved</button>
                <button type="button" aria-pressed={vendorState === "blocked"} onClick={() => setVendorState("blocked")}><X size={13} /> Blocked</button>
              </div>
            </div>

            <div className="delegated-envelope__control delegated-envelope__control--amount">
              <div className="delegated-envelope__control-label"><span>Request amount</span><code>03</code></div>
              <div className="delegated-envelope__amount-readout"><strong>{formatDemoMoney(amount)}</strong><span>USD</span></div>
              <input
                type="range"
                min="0"
                max={PUBLIC_DEMO_MAX_AMOUNT}
                step="5"
                value={amount}
                aria-label="Request amount"
                aria-valuetext={`${formatDemoMoney(amount)} US dollars`}
                onChange={(event) => setAmount(Number(event.target.value))}
              />
              <div className="delegated-envelope__range-labels"><span>$0</span><span>{formatDemoMoney(PUBLIC_DEMO_MAX_AMOUNT)}</span></div>
            </div>

            <dl className="delegated-envelope__mandate-meta">
              <div><dt>Agent</dt><dd>procurement-agent</dd></div>
              <div><dt>Vendor</dt><dd>{vendor.name}</dd></div>
              <div><dt>Approval above</dt><dd>{formatDemoMoney(PUBLIC_DEMO_APPROVAL_THRESHOLD)}</dd></div>
              <div><dt>Hard ceiling</dt><dd>{formatDemoMoney(PUBLIC_DEMO_HARD_LIMIT)}</dd></div>
            </dl>
          </aside>

          <div className="delegated-envelope__workspace" style={envelopeStyle}>
            <div className="delegated-envelope__workspace-head">
              <div><span>Delegated envelope</span><code>mandate_procurement_v3</code></div>
              <span><ShieldCheck size={14} /> Deterministic</span>
            </div>

            <div className="delegated-envelope__plot" aria-label={`Request amount ${formatDemoMoney(amount)}. Automatic approval to ${formatDemoMoney(PUBLIC_DEMO_APPROVAL_THRESHOLD)}, human approval to ${formatDemoMoney(PUBLIC_DEMO_HARD_LIMIT)}, hard stop above ${formatDemoMoney(PUBLIC_DEMO_HARD_LIMIT)}.`}>
              <div className="delegated-envelope__request-marker" aria-hidden="true"><span>Request</span><i /></div>
              <div className="delegated-envelope__zones" aria-hidden="true">
                <span className="delegated-envelope__zone delegated-envelope__zone--allow">Auto-authorized</span>
                <span className="delegated-envelope__zone delegated-envelope__zone--review">Human gate</span>
                <span className="delegated-envelope__zone delegated-envelope__zone--deny">Hard stop</span>
              </div>
              <div className="delegated-envelope__thresholds" aria-hidden="true">
                <span className="delegated-envelope__threshold delegated-envelope__threshold--zero"><i>$0</i></span>
                <span className="delegated-envelope__threshold delegated-envelope__threshold--approval"><i>{formatDemoMoney(PUBLIC_DEMO_APPROVAL_THRESHOLD)}</i><b>Approval</b></span>
                <span className="delegated-envelope__threshold delegated-envelope__threshold--hard"><i>{formatDemoMoney(PUBLIC_DEMO_HARD_LIMIT)}</i><b>Hard limit</b></span>
                <span className="delegated-envelope__threshold delegated-envelope__threshold--max"><i>{formatDemoMoney(PUBLIC_DEMO_MAX_AMOUNT)}</i></span>
              </div>
            </div>

            <div className="delegated-envelope__evaluation">
              <div className="delegated-envelope__rules">
                <div className="delegated-envelope__subhead"><span>Policy evaluation</span><code>5 gates</code></div>
                <div className="delegated-envelope__rule-list" role="list" aria-label="Policy evaluation results">
                  {evaluation.rules.map((rule, index) => (
                    <div key={rule.key} className={`delegated-envelope__rule delegated-envelope__rule--${rule.state}`} role="listitem">
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <p>{rule.label}<code>{rule.value}</code></p>
                      <strong><i>{ruleGlyphs[rule.state]}</i>{ruleLabels[rule.state]}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="delegated-envelope__result" aria-live="polite">
                <div className="delegated-envelope__subhead"><span>Policy outcome</span><span className="delegated-envelope__result-icon"><ResultIcon size={16} /></span></div>
                <div className="delegated-envelope__decision">
                  {evaluation.displayWords.map((word) => <strong key={word} className="display-title">{word}</strong>)}
                </div>
                <code className="delegated-envelope__reason">{evaluation.reason}</code>
                <div className="delegated-envelope__next"><span>Next action</span><p>{evaluation.next}</p></div>
              </div>
            </div>

            <div className="delegated-envelope__receipt">
              <div><FileCheck2 size={15} /><span>Evidence receipt</span></div>
              <dl>
                <div><dt>Request</dt><dd>{requestId}</dd></div>
                <div><dt>Capability</dt><dd>{action.capability}</dd></div>
                <div><dt>Decision</dt><dd>{evaluation.decision}</dd></div>
                <div><dt>Execution</dt><dd>not performed</dd></div>
              </dl>
            </div>
          </div>
        </div>

        <details className="delegated-envelope__payload">
          <summary><span><Braces size={14} /> Request payload</span><span>Typed JSON <ChevronDown size={14} /></span></summary>
          <div>
            <pre><code>{requestPayload}</code></pre>
            <button type="button" onClick={() => void copyText("request", requestPayload)}>
              <Clipboard size={13} /> {copied === "request" ? "Request copied" : "Copy request JSON"}
            </button>
          </div>
        </details>

        <div className="delegated-envelope__handoff">
          <p><span>Seeded demo · no funds move</span>Take this exact request into the real evaluator.</p>
          <div className="delegated-envelope__handoff-actions">
            <button type="button" onClick={copyShareLink}><Link2 size={14} /> {copied === "link" ? "Link copied" : "Copy share link"}</button>
            <Link href={labHref}>Use this mandate <ArrowRight size={15} /></Link>
          </div>
          <span className="sr-only" role="status" aria-live="polite">
            {copied === "link" ? "Share link copied" : copied === "request" ? "Request JSON copied" : ""}
          </span>
        </div>
      </div>
    </section>
  );
}
