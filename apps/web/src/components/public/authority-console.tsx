"use client";

import { gsap } from "gsap";
import { ArrowRight, Check, FileCheck2, LockKeyhole, ShieldCheck, X } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

const scenarios = [
  {
    id: "allow",
    shortLabel: "ALLOW",
    vendor: "OpenAI",
    vendorId: "openai / approved",
    amount: "$18.00",
    capability: "spend.compute",
    decision: "ALLOW",
    reason: "ALL_HARD_RULES_PASS",
    authorization: "auth_18_openai",
    tone: "permission",
    tabNote: "Within mandate",
    outcome: "The request is within every delegated limit. The agent may continue to execution.",
    trace: [
      ["Identity", "procurement-agent", "PASS"],
      ["Capability", "spend.compute", "PASS"],
      ["Vendor", "openai / approved", "PASS"],
      ["Hard ceiling", "$18.00 ≤ $150.00", "PASS"],
      ["Approval", "$18.00 ≤ $100.00", "PASS"]
    ]
  },
  {
    id: "deny",
    shortLabel: "DENY",
    vendor: "UnknownVendor",
    vendorId: "unknown / blocked",
    amount: "$30.00",
    capability: "spend.api",
    decision: "DENY",
    reason: "VENDOR_NOT_ALLOWED",
    authorization: "auth_30_unknown",
    tone: "denial",
    tabNote: "Policy block",
    outcome: "The vendor is outside the active mandate. The request stops before execution.",
    trace: [
      ["Identity", "procurement-agent", "PASS"],
      ["Capability", "spend.api", "PASS"],
      ["Vendor", "unknown / not approved", "FAIL"],
      ["Hard ceiling", "not evaluated", "CLOSED"],
      ["Approval", "cannot override failure", "CLOSED"]
    ]
  },
  {
    id: "review",
    shortLabel: "APPROVAL",
    vendor: "AWS",
    vendorId: "aws / approved",
    amount: "$120.00",
    capability: "spend.compute",
    decision: "REQUIRE_APPROVAL",
    reason: "APPROVAL_THRESHOLD_EXCEEDED",
    authorization: "auth_120_aws",
    tone: "review",
    tabNote: "Human gate",
    outcome: "The amount crosses the approval threshold. Execution pauses for one exact human decision.",
    trace: [
      ["Identity", "procurement-agent", "PASS"],
      ["Capability", "spend.compute", "PASS"],
      ["Vendor", "aws / approved", "PASS"],
      ["Hard ceiling", "$120.00 ≤ $150.00", "PASS"],
      ["Approval", "$120.00 > $100.00", "REVIEW"]
    ]
  }
] as const;

const traceGlyph = {
  PASS: "✓",
  FAIL: "×",
  REVIEW: "!",
  CLOSED: "—"
} as const;

const traceLabel = {
  PASS: "Passed",
  FAIL: "Failed",
  REVIEW: "Review",
  CLOSED: "Skipped"
} as const;

export function AuthorityConsole() {
  const [selectedId, setSelectedId] = useState<(typeof scenarios)[number]["id"]>("review");
  const root = useRef<HTMLDivElement>(null);
  const scenario = scenarios.find((item) => item.id === selectedId) ?? scenarios[0];

  useLayoutEffect(() => {
    if (!root.current) return;
    const media = gsap.matchMedia();
    media.add(
      {
        reduceMotion: "(prefers-reduced-motion: reduce)",
        motionAllowed: "(prefers-reduced-motion: no-preference)"
      },
      (context) => {
        const animated = "[data-boundary-request], [data-boundary-result], [data-boundary-rule], [data-boundary-meta]";
        if (context.conditions?.reduceMotion) {
          gsap.set(animated, { clearProps: "all" });
          return;
        }

        const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
        timeline
          .fromTo("[data-boundary-request]", { autoAlpha: 0, y: 8 }, { autoAlpha: 1, duration: 0.34, y: 0 })
          .fromTo("[data-boundary-rule]", { autoAlpha: 0, x: -8 }, { autoAlpha: 1, duration: 0.28, stagger: 0.045, x: 0 }, 0.06)
          .fromTo("[data-boundary-result]", { autoAlpha: 0, y: 8 }, { autoAlpha: 1, duration: 0.38, y: 0 }, 0.18)
          .fromTo("[data-boundary-meta]", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.28 }, 0.24);
      },
      root
    );
    return () => media.revert();
  }, [selectedId]);

  const ResultIcon = scenario.decision === "ALLOW" ? Check : scenario.decision === "DENY" ? X : LockKeyhole;
  const decisionWords = scenario.decision === "REQUIRE_APPROVAL" ? ["REQUIRE", "APPROVAL"] : [scenario.decision];

  return (
    <div ref={root} className={`authority-boundary authority-boundary--${scenario.tone}`}>
      <div className="authority-boundary__toolbar">
        <div className="authority-boundary__identity">
          <span className="authority-boundary__live-dot" />
          <div>
            <p>Authorization request</p>
            <code>{scenario.authorization}</code>
          </div>
          <span className="authority-boundary__mode">Synthetic demo</span>
        </div>
        <div className="authority-boundary__scenarios" role="tablist" aria-label="Seeded authorization scenarios">
          {scenarios.map((item, index) => (
            <button
              key={item.id}
              id={`authority-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={selectedId === item.id}
              aria-controls="authority-scenario-panel"
              tabIndex={selectedId === item.id ? 0 : -1}
              onClick={() => setSelectedId(item.id)}
              onKeyDown={(event) => {
                let nextIndex: number | undefined;
                if (event.key === "ArrowRight") nextIndex = (index + 1) % scenarios.length;
                if (event.key === "ArrowLeft") nextIndex = (index - 1 + scenarios.length) % scenarios.length;
                if (event.key === "Home") nextIndex = 0;
                if (event.key === "End") nextIndex = scenarios.length - 1;
                if (nextIndex === undefined) return;
                event.preventDefault();
                const nextScenario = scenarios[nextIndex]!;
                setSelectedId(nextScenario.id);
                root.current?.querySelector<HTMLButtonElement>(`#authority-tab-${nextScenario.id}`)?.focus();
              }}
              className="authority-boundary__scenario"
            >
              <span className="authority-boundary__scenario-index">0{index + 1}</span>
              <span className="authority-boundary__scenario-copy">
                <strong>{item.shortLabel}</strong>
                <small>{item.tabNote}</small>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div id="authority-scenario-panel" role="tabpanel" aria-labelledby={`authority-tab-${scenario.id}`}>
        <div className="authority-boundary__workspace">
          <section data-boundary-request className="authority-boundary__request" aria-labelledby="authority-request-title">
            <div className="authority-boundary__section-label">
              <span>01 / Request</span>
              <span>procurement-agent</span>
            </div>
            <p id="authority-request-title" className="authority-boundary__request-kicker">Agent requests one exact action</p>
            <div className="authority-boundary__transaction">
              <strong>{scenario.amount}</strong>
              <ArrowRight size={17} aria-hidden="true" />
              <div><span>Vendor</span><b>{scenario.vendor}</b></div>
            </div>
            <dl className="authority-boundary__request-details">
              <div><dt>Capability</dt><dd>{scenario.capability}</dd></div>
              <div><dt>Vendor policy</dt><dd>{scenario.vendorId}</dd></div>
            </dl>
          </section>

          <section className="authority-boundary__evaluation" aria-labelledby="authority-evaluation-title">
            <header className="authority-boundary__evaluation-header">
              <div>
                <span>02 / Policy evaluation</span>
                <h3 id="authority-evaluation-title">Active mandate</h3>
              </div>
              <span><ShieldCheck size={13} /> 5 gates</span>
            </header>
            <div className="authority-boundary__trace" role="list" aria-label="Policy evaluation trace">
              {scenario.trace.map(([rule, value, result], index) => (
                <div data-boundary-rule key={rule} className={`authority-boundary__rule authority-boundary__rule--${result.toLowerCase()}`} role="listitem">
                  <span className="authority-boundary__rule-index">{String(index + 1).padStart(2, "0")}</span>
                  <div className="authority-boundary__rule-copy">
                    <p>{rule}</p>
                    <code>{value}</code>
                  </div>
                  <span className="authority-boundary__rule-status"><i>{traceGlyph[result]}</i>{traceLabel[result]}</span>
                </div>
              ))}
            </div>
          </section>

          <section data-boundary-result className="authority-boundary__result" aria-live="polite" aria-labelledby="authority-decision-title">
            <div className="authority-boundary__section-label">
              <span>03 / Decision</span>
              <span className="authority-boundary__result-mark"><ResultIcon size={15} /></span>
            </div>
            <p className="authority-boundary__result-kicker">Policy outcome</p>
            <h3 id="authority-decision-title" className="authority-boundary__decision">
              {decisionWords.map((word) => <span key={word}>{word}</span>)}
            </h3>
            <code className="authority-boundary__reason">{scenario.reason}</code>
            <div className="authority-boundary__next-step">
              <span>Next action</span>
              <p>{scenario.outcome}</p>
            </div>
          </section>
        </div>

        <div data-boundary-meta className="authority-boundary__receipt">
          <div className="authority-boundary__receipt-title"><FileCheck2 size={15} /><span>Decision evidence</span></div>
          <dl>
            <div><dt>Identity</dt><dd>procurement-agent</dd></div>
            <div><dt>Mandate</dt><dd>procurement-v3</dd></div>
            <div><dt>Evaluation</dt><dd>5 gates / deterministic</dd></div>
            <div><dt>Receipt</dt><dd>ready for audit</dd></div>
          </dl>
        </div>
      </div>
    </div>
  );
}
