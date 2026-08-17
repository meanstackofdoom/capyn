"use client";

import Link from "next/link";
import { ArrowRight, Check, FileCheck2, LockKeyhole, ShieldCheck, X } from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";

const mandates = [
  {
    id: "compute",
    label: "Compute",
    capability: "spend.compute",
    vendor: "OpenAI",
    purpose: "Inference capacity",
    approval: 100,
    hard: 150,
    max: 200,
    initial: 120
  },
  {
    id: "software",
    label: "Software",
    capability: "spend.software",
    vendor: "Linear",
    purpose: "Project workspace",
    approval: 50,
    hard: 100,
    max: 140,
    initial: 75
  },
  {
    id: "travel",
    label: "Travel",
    capability: "spend.travel",
    vendor: "Qantas",
    purpose: "Approved customer visit",
    approval: 400,
    hard: 750,
    max: 1000,
    initial: 520
  }
] as const;

type RuleState = "pass" | "fail" | "review" | "skipped";

const ruleLabels: Record<RuleState, string> = {
  pass: "Passed",
  fail: "Failed",
  review: "Review",
  skipped: "Skipped"
};

const ruleGlyphs: Record<RuleState, string> = {
  pass: "✓",
  fail: "×",
  review: "!",
  skipped: "—"
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

export function DelegatedEnvelope() {
  const [mandateId, setMandateId] = useState<(typeof mandates)[number]["id"]>("compute");
  const [vendorState, setVendorState] = useState<"approved" | "blocked">("approved");
  const [amount, setAmount] = useState(120);

  const mandate = mandates.find((item) => item.id === mandateId) ?? mandates[0];
  const approvalPosition = (mandate.approval / mandate.max) * 100;
  const hardPosition = (mandate.hard / mandate.max) * 100;
  const requestPosition = Math.min((amount / mandate.max) * 100, 100);

  const evaluation = useMemo(() => {
    if (vendorState === "blocked") {
      return {
        decision: "DENY",
        displayWords: ["DENY"],
        reason: "VENDOR_NOT_ALLOWED",
        tone: "denial",
        next: "The request stops here. No execution credential is issued."
      } as const;
    }
    if (amount > mandate.hard) {
      return {
        decision: "DENY",
        displayWords: ["DENY"],
        reason: "HARD_LIMIT_EXCEEDED",
        tone: "denial",
        next: "The amount exceeds the mandate. Human approval cannot override a hard limit."
      } as const;
    }
    if (amount > mandate.approval) {
      return {
        decision: "REQUIRE_APPROVAL",
        displayWords: ["REQUIRE", "APPROVAL"],
        reason: "APPROVAL_THRESHOLD_EXCEEDED",
        tone: "review",
        next: "Execution pauses for one request-bound human decision."
      } as const;
    }
    return {
      decision: "ALLOW",
      displayWords: ["ALLOW"],
      reason: "ALL_HARD_RULES_PASS",
      tone: "permission",
      next: "Every delegated limit passes. The agent may continue to execution."
    } as const;
  }, [amount, mandate, vendorState]);

  const rules: Array<{ label: string; value: string; state: RuleState }> = [
    { label: "Identity", value: "procurement-agent", state: "pass" },
    { label: "Capability", value: mandate.capability, state: "pass" },
    { label: "Vendor", value: vendorState === "approved" ? `${mandate.vendor} / approved` : `${mandate.vendor} / blocked`, state: vendorState === "approved" ? "pass" : "fail" },
    {
      label: "Hard ceiling",
      value: vendorState === "blocked" ? "not evaluated" : `${money.format(amount)} ≤ ${money.format(mandate.hard)}`,
      state: vendorState === "blocked" ? "skipped" : amount > mandate.hard ? "fail" : "pass"
    },
    {
      label: "Approval",
      value: vendorState === "blocked" || amount > mandate.hard ? "not evaluated" : `${money.format(amount)} ${amount > mandate.approval ? ">" : "≤"} ${money.format(mandate.approval)}`,
      state: vendorState === "blocked" || amount > mandate.hard ? "skipped" : amount > mandate.approval ? "review" : "pass"
    }
  ];

  const ResultIcon = evaluation.decision === "ALLOW" ? Check : evaluation.decision === "DENY" ? X : LockKeyhole;
  const envelopeStyle = {
    "--envelope-approval": `${approvalPosition}%`,
    "--envelope-hard": `${hardPosition}%`,
    "--envelope-request": `${requestPosition}%`
  } as CSSProperties;

  return (
    <section className={`delegated-envelope delegated-envelope--${evaluation.tone}`} aria-labelledby="delegated-envelope-title">
      <div className="delegated-envelope__field" aria-hidden="true" />
      <div className="site-container delegated-envelope__shell">
        <header className="delegated-envelope__header">
          <p className="delegated-envelope__eyebrow"><span /> Live authority proof / seeded mandate</p>
          <div className="delegated-envelope__intro">
            <h2 id="delegated-envelope-title" className="display-title">Move one request. <em>Watch authority answer.</em></h2>
            <p>Change the action, vendor policy or amount. CAPYN returns the exact next step before anything executes.</p>
          </div>
        </header>

        <div className="delegated-envelope__instrument">
          <aside className="delegated-envelope__controls" aria-label="Authorization request controls">
            <div className="delegated-envelope__control">
              <div className="delegated-envelope__control-label"><span>Action</span><code>01</code></div>
              <div className="delegated-envelope__choices" aria-label="Action type">
                {mandates.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={mandate.id === item.id}
                    onClick={() => {
                      setMandateId(item.id);
                      setAmount(item.initial);
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
              <div className="delegated-envelope__amount-readout"><strong>{money.format(amount)}</strong><span>USD</span></div>
              <input
                type="range"
                min="0"
                max={mandate.max}
                step={mandate.max >= 500 ? 10 : 5}
                value={amount}
                aria-label="Request amount"
                aria-valuetext={`${money.format(amount)} US dollars`}
                onChange={(event) => setAmount(Number(event.target.value))}
              />
              <div className="delegated-envelope__range-labels"><span>$0</span><span>{money.format(mandate.max)}</span></div>
            </div>

            <dl className="delegated-envelope__mandate-meta">
              <div><dt>Agent</dt><dd>procurement-agent</dd></div>
              <div><dt>Purpose</dt><dd>{mandate.purpose}</dd></div>
              <div><dt>Approval above</dt><dd>{money.format(mandate.approval)}</dd></div>
              <div><dt>Hard ceiling</dt><dd>{money.format(mandate.hard)}</dd></div>
            </dl>
          </aside>

          <div className="delegated-envelope__workspace" style={envelopeStyle}>
            <div className="delegated-envelope__workspace-head">
              <div><span>Delegated envelope</span><code>mandate_procurement_v3</code></div>
              <span><ShieldCheck size={14} /> Deterministic</span>
            </div>

            <div className="delegated-envelope__plot" aria-label={`Request amount ${money.format(amount)}. Automatic approval to ${money.format(mandate.approval)}, human approval to ${money.format(mandate.hard)}, hard stop above ${money.format(mandate.hard)}.`}>
              <div className="delegated-envelope__request-marker" aria-hidden="true"><span>Request</span><i /></div>
              <div className="delegated-envelope__zones" aria-hidden="true">
                <span className="delegated-envelope__zone delegated-envelope__zone--allow">Auto-authorized</span>
                <span className="delegated-envelope__zone delegated-envelope__zone--review">Human gate</span>
                <span className="delegated-envelope__zone delegated-envelope__zone--deny">Hard stop</span>
              </div>
              <div className="delegated-envelope__thresholds" aria-hidden="true">
                <span className="delegated-envelope__threshold delegated-envelope__threshold--zero"><i>$0</i></span>
                <span className="delegated-envelope__threshold delegated-envelope__threshold--approval"><i>{money.format(mandate.approval)}</i><b>Approval</b></span>
                <span className="delegated-envelope__threshold delegated-envelope__threshold--hard"><i>{money.format(mandate.hard)}</i><b>Hard limit</b></span>
                <span className="delegated-envelope__threshold delegated-envelope__threshold--max"><i>{money.format(mandate.max)}</i></span>
              </div>
            </div>

            <div className="delegated-envelope__evaluation">
              <div className="delegated-envelope__rules">
                <div className="delegated-envelope__subhead"><span>Policy evaluation</span><code>5 gates</code></div>
                <div className="delegated-envelope__rule-list" role="list" aria-label="Policy evaluation results">
                  {rules.map((rule, index) => (
                    <div key={rule.label} className={`delegated-envelope__rule delegated-envelope__rule--${rule.state}`} role="listitem">
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
                <div><dt>Request</dt><dd>demo_{mandate.id}_{amount}</dd></div>
                <div><dt>Decision</dt><dd>{evaluation.decision}</dd></div>
                <div><dt>Execution</dt><dd>not performed</dd></div>
              </dl>
            </div>
          </div>
        </div>

        <div className="delegated-envelope__handoff">
          <p><span>Seeded demo · no funds move</span>Want to test the full policy engine?</p>
          <Link href="/lab">Open the Authority Lab <ArrowRight size={15} /></Link>
        </div>
      </div>
    </section>
  );
}
