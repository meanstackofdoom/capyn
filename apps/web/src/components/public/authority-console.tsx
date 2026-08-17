"use client";

import { gsap } from "gsap";
import { Check, LockKeyhole, ShieldCheck, X } from "lucide-react";
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
        const animated = "[data-boundary-request], [data-boundary-ring], [data-boundary-result], [data-boundary-rule]";
        if (context.conditions?.reduceMotion) {
          gsap.set(animated, { clearProps: "all" });
          return;
        }

        const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
        timeline
          .fromTo("[data-boundary-request]", { autoAlpha: 0, x: -28 }, { autoAlpha: 1, duration: 0.46, x: 0 })
          .fromTo("[data-boundary-ring]", { autoAlpha: 0.2, scale: 0.82 }, { autoAlpha: 1, duration: 0.72, scale: 1, stagger: 0.06 }, 0.08)
          .fromTo("[data-boundary-result]", { autoAlpha: 0, x: 28 }, { autoAlpha: 1, duration: 0.52, x: 0 }, 0.34)
          .fromTo("[data-boundary-rule]", { autoAlpha: 0, y: 8 }, { autoAlpha: 1, duration: 0.32, stagger: 0.045, y: 0 }, 0.28);
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
        <div className="authority-boundary__live">
          <span className="authority-boundary__live-dot" />
          <span>Live policy boundary</span>
          <span className="authority-boundary__authorization">{scenario.authorization}</span>
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
              <span>0{index + 1}</span>
              <span>{item.shortLabel}</span>
            </button>
          ))}
        </div>
      </div>

      <div id="authority-scenario-panel" role="tabpanel" aria-labelledby={`authority-tab-${scenario.id}`}>
        <div className="authority-boundary__stage">
          <div className="authority-boundary__stage-labels" aria-hidden="true">
            <span>Agent intent</span>
            <span>Authority boundary</span>
            <span>Consequence</span>
          </div>

          <div className="authority-boundary__flow" aria-hidden="true">
            <span className="authority-boundary__packet" />
          </div>

          <div data-boundary-request className="authority-boundary__request">
            <div className="authority-boundary__card-label">
              <span>Request</span>
              <span>procurement-agent</span>
            </div>
            <div className="authority-boundary__request-main">
              <p>{scenario.amount}</p>
              <p>→ {scenario.vendor}</p>
            </div>
            <div className="authority-boundary__request-meta">
              <span>{scenario.capability}</span>
              <span>{scenario.vendorId}</span>
            </div>
          </div>

          <div className="authority-boundary__gate" aria-hidden="true">
            <span data-boundary-ring className="authority-boundary__ring authority-boundary__ring--outer" />
            <span data-boundary-ring className="authority-boundary__ring authority-boundary__ring--middle" />
            <span data-boundary-ring className="authority-boundary__ring authority-boundary__ring--inner" />
            <span className="authority-boundary__axis" />
            <span className="authority-boundary__core"><ShieldCheck size={20} /></span>
          </div>

          <div data-boundary-result className="authority-boundary__result" aria-live="polite">
            <div className="authority-boundary__card-label">
              <span>Decision</span>
              <ResultIcon size={13} />
            </div>
            <div className="authority-boundary__decision">
              {decisionWords.map((word) => <span key={word}>{word}</span>)}
            </div>
            <p className="authority-boundary__reason">{scenario.reason}</p>
          </div>
        </div>

        <div className="authority-boundary__trace-scroll">
          <div className="authority-boundary__trace" role="list" aria-label="Policy evaluation trace">
            {scenario.trace.map(([rule, value, result], index) => (
              <div data-boundary-rule key={rule} className={`authority-boundary__rule authority-boundary__rule--${result.toLowerCase()}`} role="listitem">
                <div className="authority-boundary__rule-top">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <span className="authority-boundary__rule-glyph">{traceGlyph[result]}</span>
                </div>
                <p>{rule}</p>
                <span className="authority-boundary__rule-value">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
