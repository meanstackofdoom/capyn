"use client";

import { gsap } from "gsap";
import { Check, LockKeyhole, ShieldCheck, X } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

const scenarios = [
  {
    id: "allow",
    shortLabel: "ALLOW",
    vendor: "OpenAI",
    amount: "$18.00",
    capability: "spend.compute",
    decision: "ALLOW",
    reason: "ALL_HARD_RULES_PASS",
    authorization: "auth_18_openai",
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
    amount: "$30.00",
    capability: "spend.api",
    decision: "DENY",
    reason: "VENDOR_NOT_ALLOWED",
    authorization: "auth_30_unknown",
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
    amount: "$120.00",
    capability: "spend.compute",
    decision: "REQUIRE_APPROVAL",
    reason: "APPROVAL_THRESHOLD_EXCEEDED",
    authorization: "auth_120_aws",
    trace: [
      ["Identity", "procurement-agent", "PASS"],
      ["Capability", "spend.compute", "PASS"],
      ["Vendor", "aws / approved", "PASS"],
      ["Hard ceiling", "$120.00 ≤ $150.00", "PASS"],
      ["Approval", "$120.00 > $100.00", "REVIEW"]
    ]
  }
] as const;

const decisionTone = {
  ALLOW: "border-permission/35 bg-permission/10 text-permission",
  DENY: "border-denial/35 bg-denial/10 text-denial",
  REQUIRE_APPROVAL: "border-review/35 bg-review/10 text-review"
} as const;

const traceTone = {
  PASS: "text-permission",
  FAIL: "text-denial",
  REVIEW: "text-review",
  CLOSED: "text-muted"
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
        if (context.conditions?.reduceMotion) {
          gsap.set("[data-authority-row], [data-authority-result], [data-authority-progress]", {
            clearProps: "all"
          });
          return;
        }
        const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
        timeline
          .fromTo(
            "[data-authority-row]",
            { autoAlpha: 0, x: -12 },
            { autoAlpha: 1, duration: 0.38, stagger: 0.065, x: 0 }
          )
          .fromTo(
            "[data-authority-progress]",
            { scaleX: 0 },
            { duration: 0.8, ease: "power2.inOut", scaleX: 1 },
            0
          )
          .fromTo(
            "[data-authority-result]",
            { autoAlpha: 0, y: 8 },
            { autoAlpha: 1, duration: 0.42, y: 0 },
            "-=0.2"
          );
      },
      root
    );
    return () => media.revert();
  }, [selectedId]);

  const ResultIcon = scenario.decision === "ALLOW" ? Check : scenario.decision === "DENY" ? X : LockKeyhole;

  return (
    <div ref={root} className="overflow-hidden border border-line bg-panel shadow-[0_30px_80px_rgba(12,32,48,.12)]">
      <div className="grid grid-cols-3 gap-px border-b border-line bg-line" role="tablist" aria-label="Seeded authorization scenarios">
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
            className={`min-w-0 bg-panel px-3 py-3 text-left transition-colors sm:px-4 ${selectedId === item.id ? "text-ink" : "text-muted hover:bg-paper hover:text-ink"}`}
          >
            <span className="font-mono text-[8px]">0{index + 1}</span>
            <span className="mt-1 block truncate font-mono text-[8px] font-medium sm:text-[9px]">{item.shortLabel}</span>
          </button>
        ))}
      </div>

      <div id="authority-scenario-panel" role="tabpanel" aria-labelledby={`authority-tab-${scenario.id}`}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[.16em] text-muted">Live authority explainer</p>
            <p className="mt-1.5 font-mono text-[10px]">{scenario.authorization}</p>
          </div>
          <ShieldCheck size={16} className="text-authority" />
        </div>

        <div className="grid grid-cols-3 gap-px bg-line">
          {[
            ["Vendor", scenario.vendor],
            ["Amount", scenario.amount],
            ["Capability", scenario.capability]
          ].map(([label, value]) => (
            <div key={label} className="min-w-0 bg-paper p-3.5 sm:p-4">
              <p className="font-mono text-[8px] uppercase tracking-[.13em] text-muted">{label}</p>
              <p className="mt-2 truncate text-[10px] font-bold sm:text-[11px]">{value}</p>
            </div>
          ))}
        </div>

        <div className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <p className="font-mono text-[9px] uppercase tracking-[.15em] text-muted">Policy signal</p>
            <p className="font-mono text-[8px] text-muted">seed / acme-ai</p>
          </div>
          <div className="relative border-l border-authority/50 pl-5">
            <span data-authority-progress className="absolute -left-px top-0 h-full w-px origin-top bg-authority" />
            {scenario.trace.map(([rule, value, result], index) => (
              <div data-authority-row key={rule} className="grid grid-cols-[20px_1fr_auto] items-center gap-3 border-b border-line/70 py-2.5 last:border-0">
                <span className="font-mono text-[8px] text-muted">{String(index + 1).padStart(2, "0")}</span>
                <p className="min-w-0 truncate text-[10px] sm:text-[11px]"><span className="text-muted">{rule}</span><span className="mx-2 text-line">/</span>{value}</p>
                <span className={`font-mono text-[8px] ${traceTone[result]}`}>{result}</span>
              </div>
            ))}
          </div>
        </div>

        <div data-authority-result aria-live="polite" className={`flex items-center justify-between gap-4 border-t px-5 py-4 ${decisionTone[scenario.decision]}`}>
          <div className="min-w-0">
            <p className="font-mono text-[8px] uppercase tracking-[.16em]">Decision</p>
            <p className="mt-1 truncate text-sm font-extrabold">{scenario.decision}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-[8px] sm:block">{scenario.reason}</span>
            <ResultIcon size={17} />
          </div>
        </div>
      </div>
    </div>
  );
}
