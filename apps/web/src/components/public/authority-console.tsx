"use client";

import type { ApiErrorBody, LabEvaluateRequest, LabEvaluationResult, RuleTrace } from "@capyn/types";
import { gsap } from "gsap";
import { ArrowRight, ArrowUpRight, Check, FileCheck2, LoaderCircle, LockKeyhole, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createLabHandoffHref, publicLabCapabilities, publicLabVendors } from "@/lib/demo-authority";
import { createLabProofBundle, createLabProofHref } from "@/lib/lab-proof";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const presets = [
  {
    id: "within",
    label: "Within mandate",
    expectation: "ALLOW",
    request: {
      capability: "spend.compute",
      amount: { value: "18.00", currency: "USD" },
      vendor: { id: "openai", name: "OpenAI" },
      purpose: "Inference capacity for a customer workflow"
    }
  },
  {
    id: "human",
    label: "Human line",
    expectation: "REVIEW",
    request: {
      capability: "spend.compute",
      amount: { value: "120.00", currency: "USD" },
      vendor: { id: "aws", name: "AWS" },
      purpose: "Scale compute for the nightly evaluation run"
    }
  },
  {
    id: "stop",
    label: "Hard stop",
    expectation: "DENY",
    request: {
      capability: "transfer.wallet",
      amount: { value: "30.00", currency: "USD" },
      vendor: { id: "github", name: "GitHub" },
      purpose: "Move funds to an unapproved software vendor"
    }
  }
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  expectation: string;
  request: LabEvaluateRequest;
}>;

const featuredRules = ["agentStatus", "capability", "vendor", "transactionLimit", "approvalThreshold"] as const;
const ruleLabels: Record<(typeof featuredRules)[number], string> = {
  agentStatus: "Identity",
  capability: "Capability",
  vendor: "Vendor",
  transactionLimit: "Per action",
  approvalThreshold: "Human line"
};

type Phase = "idle" | "evaluating" | "decided" | "error";
type Tone = "neutral" | "permission" | "review" | "denial";
type TraceState = "pass" | "fail" | "review" | "pending";
type TraceView = { key: string; label: string; value: string; state: TraceState };

const traceGlyph: Record<TraceState, string> = { pass: "✓", fail: "×", review: "!", pending: "·" };
const traceLabel: Record<TraceState, string> = { pass: "Passed", fail: "Failed", review: "Review", pending: "Waiting" };

function cloneRequest(request: LabEvaluateRequest): LabEvaluateRequest {
  return { ...request, amount: { ...request.amount }, vendor: { ...request.vendor } };
}

function minorToMoney(value?: string): string | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const minor = BigInt(value);
  return `$${minor / 100n}.${(minor % 100n).toString().padStart(2, "0")}`;
}

function traceDetail(step: RuleTrace): string {
  const details = step.details;
  if (!details) return step.reasonCode.replaceAll("_", " ");
  if (step.rule === "agentStatus") return "procurement-agent / active";
  if (step.rule === "capability") return details.requested ?? step.reasonCode;
  if (step.rule === "vendor") return details.vendorId ?? step.reasonCode;

  const amount = minorToMoney(details.amountMinor);
  const limit = minorToMoney(details.limitMinor);
  if (step.rule === "transactionLimit" && amount && limit) return `${amount} / ${limit}`;
  if (step.rule === "approvalThreshold" && amount) {
    const threshold = minorToMoney(details.thresholdMinor);
    return `${amount} / ${threshold ?? "threshold"}`;
  }
  return step.reasonCode.replaceAll("_", " ");
}

function decisionTone(result: LabEvaluationResult | null, error: string | null): Tone {
  if (error || result?.decision === "DENY") return "denial";
  if (result?.decision === "ALLOW") return "permission";
  if (result?.decision === "REQUIRE_APPROVAL") return "review";
  return "neutral";
}

function decisionCopy(result: LabEvaluationResult | null, phase: Phase, error: string | null) {
  if (error) return { words: ["CHECK", "FAILED"], reason: "POLICY_ENGINE_UNAVAILABLE", next: error };
  if (phase === "evaluating") return { words: ["CROSSING"], reason: "NINE_GATES_IN_FLIGHT", next: "CAPYN is evaluating identity, mandate, limits and the human line." };
  if (result?.decision === "ALLOW") return { words: ["ALLOW"], reason: "ALL_HARD_RULES_PASS", next: "Every hard rule passed. Mock execution reached." };
  if (result?.decision === "DENY") return { words: ["DENY"], reason: result.reasonCodes[0] ?? "REQUEST_STOPPED", next: result.reasons[0]?.description ?? "The action stopped before execution." };
  if (result?.decision === "REQUIRE_APPROVAL") return { words: ["HUMAN", "REQUIRED"], reason: "APPROVAL_THRESHOLD_EXCEEDED", next: "Hard rules passed. One exact request is waiting for a human." };
  return { words: ["UNDECIDED"], reason: "AWAITING_EXACT_ACTION", next: "Change the sentence above, then send that exact action across the line." };
}

async function readApi<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store"
  });
  const payload = await response.json() as T | ApiErrorBody;
  if (!response.ok) {
    const apiError = payload as ApiErrorBody;
    throw new Error(apiError.error?.message ?? "The policy engine could not complete this request");
  }
  return payload as T;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export function AuthorityConsole() {
  const [form, setForm] = useState<LabEvaluateRequest>(() => cloneRequest(presets[1].request));
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<LabEvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const crossing = useRef<HTMLSpanElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);

  const tone = decisionTone(result, error);
  const decision = decisionCopy(result, phase, error);
  const busy = phase === "evaluating";
  const activePreset = presets.find((preset) => JSON.stringify(preset.request) === JSON.stringify(form))?.id;
  const request = result?.request ?? form;
  const vendorStatus = publicLabVendors.find((vendor) => vendor.id === request.vendor.id)?.status ?? "unknown";
  const proofBundle = useMemo(
    () => result ? createLabProofBundle(result.authorizationId, result.request, result.evidence) : null,
    [result]
  );
  const proofHref = useMemo(() => proofBundle ? createLabProofHref(proofBundle) : null, [proofBundle]);
  const labHref = useMemo(() => createLabHandoffHref(form, "homepage"), [form]);
  const trace = useMemo<TraceView[]>(() => featuredRules.map((rule) => {
    const step = result?.trace.find((entry) => entry.rule === rule);
    return step
      ? { key: rule, label: ruleLabels[rule], value: traceDetail(step), state: step.result.toLowerCase() as Exclude<TraceState, "pending"> }
      : { key: rule, label: ruleLabels[rule], value: "awaiting exact action", state: "pending" };
  }), [result]);

  useLayoutEffect(() => {
    timeline.current?.kill();
    if (!root.current || !crossing.current) return;
    const media = gsap.matchMedia();
    media.add(
      {
        reduceMotion: "(prefers-reduced-motion: reduce)",
        motionAllowed: "(prefers-reduced-motion: no-preference)"
      },
      (context) => {
        const reveal = root.current?.querySelectorAll("[data-boundary-rule], [data-boundary-result], [data-boundary-meta]") ?? [];
        if (context.conditions?.reduceMotion) {
          gsap.set(crossing.current, { scaleX: phase === "idle" ? 0 : 1 });
          gsap.set(reveal, { clearProps: "all" });
          return;
        }
        if (phase === "idle") {
          gsap.set(crossing.current, { scaleX: 0, transformOrigin: "left center" });
          return;
        }
        if (phase === "evaluating") {
          timeline.current = gsap.timeline().fromTo(
            crossing.current,
            { scaleX: 0, transformOrigin: "left center" },
            { duration: 0.72, ease: "power2.inOut", scaleX: 1 }
          );
          return;
        }
        gsap.set(crossing.current, { scaleX: 1, transformOrigin: "left center" });
        timeline.current = gsap.timeline({ defaults: { ease: "power3.out" } })
          .fromTo("[data-boundary-rule]", { autoAlpha: 0, x: -7 }, { autoAlpha: 1, duration: 0.28, stagger: 0.045, x: 0 })
          .fromTo("[data-boundary-result]", { autoAlpha: 0, y: 8 }, { autoAlpha: 1, duration: 0.38, y: 0 }, 0.12)
          .fromTo("[data-boundary-meta]", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.28 }, 0.2);
      },
      root
    );
    return () => {
      timeline.current?.kill();
      media.revert();
    };
  }, [phase, result]);

  function clearDecision(): void {
    setResult(null);
    setError(null);
    setPhase("idle");
  }

  function applyPreset(preset: (typeof presets)[number]): void {
    setForm(cloneRequest(preset.request));
    clearDecision();
  }

  async function evaluate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPhase("evaluating");
    setResult(null);
    setError(null);
    try {
      const exactRequest: LabEvaluateRequest = {
        ...form,
        amount: { ...form.amount, value: form.amount.value.trim() },
        purpose: form.purpose.trim()
      };
      const wait = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 760;
      const [evaluation] = await Promise.all([
        readApi<LabEvaluationResult>("/v1/lab/evaluate", exactRequest),
        sleep(wait)
      ]);
      setForm(exactRequest);
      setResult(evaluation);
      setPhase("decided");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The policy engine could not complete this request");
      setPhase("error");
    }
  }

  const ResultIcon = busy ? LoaderCircle : result?.decision === "ALLOW" ? Check : result?.decision === "DENY" || error ? X : LockKeyhole;

  return (
    <div id="authority-check" ref={root} className={`authority-boundary authority-boundary--${tone}`} data-phase={phase} aria-busy={busy}>
      <div className="authority-boundary__toolbar">
        <div className="authority-boundary__identity">
          <span className="authority-boundary__live-dot" />
          <div>
            <p>Live authority check</p>
            <code>{result?.authorizationId ?? "awaiting_exact_action"}</code>
          </div>
          <span className="authority-boundary__mode">Real policy · Synthetic execution</span>
        </div>
        <div className="authority-boundary__scenarios" role="group" aria-label="Load an example boundary">
          {presets.map((preset, index) => (
            <button
              key={preset.id}
              type="button"
              aria-pressed={activePreset === preset.id}
              disabled={busy}
              onClick={() => applyPreset(preset)}
              className="authority-boundary__scenario"
            >
              <span className="authority-boundary__scenario-index">0{index + 1}</span>
              <span className="authority-boundary__scenario-copy">
                <strong>{preset.label}</strong>
                <small>{preset.expectation}</small>
              </span>
            </button>
          ))}
        </div>
      </div>

      <form className="authority-boundary__composer" onSubmit={(event) => void evaluate(event)}>
        <div className="authority-boundary__composer-label">
          <span>Write one exact authority sentence</span>
          <span>No sign-in · No persistence · No real funds</span>
        </div>
        <div className="authority-boundary__sentence">
          <strong>procurement-agent may</strong>
          <label>
            <span className="sr-only">Capability</span>
            <select
              aria-label="Capability"
              value={form.capability}
              disabled={busy}
              onChange={(event) => {
                setForm((current) => ({ ...current, capability: event.target.value }));
                clearDecision();
              }}
            >
              {publicLabCapabilities.map((capability) => <option key={capability.id} value={capability.id}>{capability.label}</option>)}
            </select>
          </label>
          <span>up to</span>
          <label className="authority-boundary__amount">
            <span aria-hidden="true">$</span>
            <input
              required
              aria-label="Amount in US dollars"
              inputMode="decimal"
              pattern="(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,2})?"
              value={form.amount.value}
              disabled={busy}
              onChange={(event) => {
                setForm((current) => ({ ...current, amount: { ...current.amount, value: event.target.value } }));
                clearDecision();
              }}
            />
          </label>
          <span>at</span>
          <label>
            <span className="sr-only">Vendor</span>
            <select
              aria-label="Vendor"
              value={form.vendor.id}
              disabled={busy}
              onChange={(event) => {
                const vendor = publicLabVendors.find((entry) => entry.id === event.target.value) ?? publicLabVendors[0];
                setForm((current) => ({ ...current, vendor: { id: vendor.id, name: vendor.name } }));
                clearDecision();
              }}
            >
              {publicLabVendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
            </select>
          </label>
        </div>
        <div className="authority-boundary__intent">
          <span>because</span>
          <label>
            <span className="sr-only">Purpose</span>
            <input
              required
              minLength={3}
              maxLength={160}
              aria-label="Purpose"
              value={form.purpose}
              disabled={busy}
              onChange={(event) => {
                setForm((current) => ({ ...current, purpose: event.target.value }));
                clearDecision();
              }}
            />
          </label>
          <button type="submit" disabled={busy}>
            {busy ? <LoaderCircle className="lab-spinner" size={15} /> : <ArrowRight size={15} />}
            {busy ? "Crossing nine gates" : "Cross the line"}
          </button>
        </div>
      </form>

      <div className="authority-boundary__crossing" aria-hidden="true"><span ref={crossing} /></div>

      <div className="authority-boundary__workspace">
        <section className="authority-boundary__request" aria-labelledby="authority-request-title">
          <div className="authority-boundary__section-label">
            <span>01 / Exact action</span>
            <span>procurement-agent</span>
          </div>
          <p id="authority-request-title" className="authority-boundary__request-kicker">The sentence becomes a request</p>
          <div className="authority-boundary__transaction">
            <strong>${request.amount.value}</strong>
            <ArrowRight size={17} aria-hidden="true" />
            <div><span>Vendor</span><b>{request.vendor.name ?? request.vendor.id}</b></div>
          </div>
          <dl className="authority-boundary__request-details">
            <div><dt>Capability</dt><dd>{request.capability}</dd></div>
            <div><dt>Vendor policy</dt><dd>{request.vendor.id} / {vendorStatus}</dd></div>
            <div><dt>Purpose</dt><dd title={request.purpose}>{request.purpose}</dd></div>
          </dl>
        </section>

        <section className="authority-boundary__evaluation" aria-labelledby="authority-evaluation-title">
          <header className="authority-boundary__evaluation-header">
            <div>
              <span>02 / Live policy evaluation</span>
              <h3 id="authority-evaluation-title">Procurement mandate v3</h3>
            </div>
            <span><ShieldCheck size={13} /> 5 decisive / 9 total</span>
          </header>
          <div className="authority-boundary__trace" role="list" aria-label="Policy evaluation trace">
            {trace.map((step, index) => (
              <div data-boundary-rule key={step.key} className={`authority-boundary__rule authority-boundary__rule--${step.state}`} role="listitem">
                <span className="authority-boundary__rule-index">{String(index + 1).padStart(2, "0")}</span>
                <div className="authority-boundary__rule-copy"><p>{step.label}</p><code>{step.value}</code></div>
                <span className="authority-boundary__rule-status"><i>{traceGlyph[step.state]}</i>{traceLabel[step.state]}</span>
              </div>
            ))}
          </div>
        </section>

        <section data-boundary-result className="authority-boundary__result" aria-live="polite" aria-labelledby="authority-decision-title">
          <div className="authority-boundary__section-label">
            <span>03 / Consequence</span>
            <span className="authority-boundary__result-mark"><ResultIcon className={busy ? "lab-spinner" : undefined} size={15} /></span>
          </div>
          <p className="authority-boundary__result-kicker">Policy outcome</p>
          <h3 id="authority-decision-title" className="authority-boundary__decision" aria-label={decision.words.join(" ")}>
            {decision.words.map((word) => <span key={word}>{word}</span>)}
          </h3>
          <code className="authority-boundary__reason">{decision.reason}</code>
          <div className="authority-boundary__next-step"><span>What happens next</span><p>{decision.next}</p></div>
        </section>
      </div>

      <div data-boundary-meta className="authority-boundary__receipt">
        <div className="authority-boundary__receipt-title"><FileCheck2 size={15} /><span>{result ? "Evidence issued" : "Evidence follows the decision"}</span></div>
        <dl>
          <div><dt>Identity</dt><dd>procurement-agent</dd></div>
          <div><dt>Mandate</dt><dd>procurement-v3</dd></div>
          <div><dt>Evaluation</dt><dd>{result ? `${result.trace.length} gates / deterministic` : "awaiting request"}</dd></div>
          <div><dt>Receipt</dt><dd>{result?.evidence.receiptId ?? "not issued"}</dd></div>
        </dl>
        <div className="authority-boundary__receipt-actions">
          {proofHref ? <a href={proofHref}>Verify receipt <ArrowUpRight size={13} /></a> : <span>Run once to issue proof</span>}
          <Link href={labHref}>Open full Lab <ArrowRight size={13} /></Link>
        </div>
      </div>
      <span className="sr-only" role="status" aria-live="polite">{error ?? (result ? `${result.decision} decision and evidence issued` : "")}</span>
    </div>
  );
}
