"use client";

import Link from "next/link";
import type { CSSProperties, FormEvent } from "react";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  Clipboard,
  Fingerprint,
  Gauge,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  X
} from "lucide-react";
import type {
  ApiErrorBody,
  LabEvaluationResult,
  LabEvaluateRequest,
  LabEvidence,
  LabResolutionResult,
  RuleTrace
} from "@capyn/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const presets = [
  {
    id: "routine",
    label: "Within bounds",
    expectation: "ALLOW",
    request: {
      capability: "spend.compute",
      amount: { value: "18.00", currency: "USD" },
      vendor: { id: "openai", name: "OpenAI" },
      purpose: "Inference capacity for a customer workflow"
    }
  },
  {
    id: "review",
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
    id: "blocked",
    label: "Outside mandate",
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

const vendors = [
  { id: "openai", name: "OpenAI", status: "approved" },
  { id: "anthropic", name: "Anthropic", status: "approved" },
  { id: "aws", name: "AWS", status: "approved" },
  { id: "github", name: "GitHub", status: "not approved" }
] as const;

const capabilities = [
  { id: "spend.compute", label: "Spend / compute", status: "granted" },
  { id: "spend.api", label: "Spend / API", status: "granted" },
  { id: "spend.software", label: "Spend / software", status: "not granted" },
  { id: "transfer.wallet", label: "Transfer / wallet", status: "not granted" }
] as const;

const idleRules = [
  "agentStatus",
  "mandate",
  "expiry",
  "capability",
  "vendor",
  "transactionLimit",
  "dailyLimit",
  "monthlyLimit",
  "approvalThreshold"
] as const;

const ruleLabels: Record<string, string> = {
  agentStatus: "Identity",
  mandate: "Mandate",
  expiry: "Time",
  capability: "Capability",
  vendor: "Vendor",
  transactionLimit: "Per action",
  dailyLimit: "Day budget",
  monthlyLimit: "Month budget",
  approvalThreshold: "Human line",
  configuration: "Configuration"
};

type Phase = "idle" | "evaluating" | "decided" | "resolving" | "resolved" | "error";
type Tone = "neutral" | "permission" | "review" | "denial";

function minorToMoney(value?: string): string | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const minor = BigInt(value);
  return `$${minor / 100n}.${(minor % 100n).toString().padStart(2, "0")}`;
}

function traceDetail(step: RuleTrace): string {
  const details = step.details;
  if (!details) return step.reasonCode.replaceAll("_", " ");
  if (step.rule === "agentStatus") return "procurement-agent / active";
  if (step.rule === "mandate") return "procurement-v3 / active";
  if (step.rule === "expiry") return "valid now";
  if (step.rule === "capability") return details.requested ?? step.reasonCode;
  if (step.rule === "vendor") return details.vendorId ?? step.reasonCode;

  const amount = minorToMoney(details.amountMinor);
  const limit = minorToMoney(details.limitMinor);
  const projected = minorToMoney(details.projectedSpendMinor);
  if (step.rule === "transactionLimit" && amount && limit) return `${amount} / ${limit}`;
  if ((step.rule === "dailyLimit" || step.rule === "monthlyLimit") && projected && limit) {
    return `${projected} / ${limit}`;
  }
  if (step.rule === "approvalThreshold" && amount) {
    const threshold = minorToMoney(details.thresholdMinor);
    return details.approvalAlreadyGranted === "true"
      ? `${amount} / approval bound`
      : `${amount} / ${threshold ?? "threshold"}`;
  }
  return step.reasonCode.replaceAll("_", " ");
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
    throw new Error(apiError.error?.message ?? "The lab could not complete this request");
  }
  return payload as T;
}

function decisionTone(evaluation: LabEvaluationResult | null, resolution: LabResolutionResult | null, error: string | null): Tone {
  if (error) return "denial";
  if (resolution) return resolution.resolution === "APPROVED" ? "permission" : "denial";
  if (!evaluation) return "neutral";
  if (evaluation.decision === "ALLOW") return "permission";
  if (evaluation.decision === "REQUIRE_APPROVAL") return "review";
  return "denial";
}

function decisionCopy(evaluation: LabEvaluationResult | null, resolution: LabResolutionResult | null, error: string | null) {
  if (error) return { label: "TRY AGAIN", reason: error, glyph: "×" };
  if (resolution?.resolution === "APPROVED") {
    return { label: "APPROVED", reason: "Exact request approved. Mock execution reached.", glyph: "✓" };
  }
  if (resolution?.resolution === "REJECTED") {
    return { label: "REJECTED", reason: "Human rejection closed this exact request.", glyph: "×" };
  }
  if (evaluation?.decision === "ALLOW") {
    return { label: "ALLOW", reason: "Every hard rule passed. Mock execution reached.", glyph: "✓" };
  }
  if (evaluation?.decision === "DENY") {
    return { label: "DENY", reason: evaluation.reasonCodes.join(" · "), glyph: "×" };
  }
  if (evaluation?.decision === "REQUIRE_APPROVAL") {
    return { label: "HUMAN\nREQUIRED", reason: "Hard rules passed. One exact request is waiting.", glyph: "!" };
  }
  return { label: "UNDECIDED", reason: "Compose an intent, then send it across the authority rail.", glyph: "·" };
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export function AuthorityLab() {
  const [form, setForm] = useState<LabEvaluateRequest>({ ...presets[1].request });
  const [phase, setPhase] = useState<Phase>("idle");
  const [evaluation, setEvaluation] = useState<LabEvaluationResult | null>(null);
  const [resolution, setResolution] = useState<LabResolutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const tone = decisionTone(evaluation, resolution, error);
  const decision = decisionCopy(evaluation, resolution, error);
  const trace = useMemo(() => resolution?.trace ?? evaluation?.trace ?? [], [evaluation, resolution]);
  const evidence: LabEvidence | null = resolution?.evidence ?? evaluation?.evidence ?? null;
  const activePreset = presets.find((preset) => JSON.stringify(preset.request) === JSON.stringify(form))?.id;
  const busy = phase === "evaluating" || phase === "resolving";

  const railStop = useMemo(() => {
    if (!trace.length) return 0;
    if (resolution?.resolution === "APPROVED") return 100;
    const firstBoundary = trace.findIndex((step) => step.result !== "PASS");
    if (firstBoundary < 0) return 100;
    return (firstBoundary / Math.max(trace.length - 1, 1)) * 100;
  }, [resolution, trace]);

  function clearDecision(): void {
    setEvaluation(null);
    setResolution(null);
    setError(null);
    setCopied(false);
    setPhase("idle");
  }

  function applyPreset(preset: (typeof presets)[number]): void {
    setForm({ ...preset.request, amount: { ...preset.request.amount }, vendor: { ...preset.request.vendor } });
    clearDecision();
  }

  async function evaluate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPhase("evaluating");
    setEvaluation(null);
    setResolution(null);
    setError(null);
    setCopied(false);
    try {
      const request: LabEvaluateRequest = {
        ...form,
        amount: { ...form.amount, value: form.amount.value.trim() },
        purpose: form.purpose.trim()
      };
      const minimumWait = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 780;
      const [result] = await Promise.all([
        readApi<LabEvaluationResult>("/v1/lab/evaluate", request),
        sleep(minimumWait)
      ]);
      setForm(request);
      setEvaluation(result);
      setPhase("decided");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The lab could not complete this request");
      setPhase("error");
    }
  }

  async function resolveApproval(action: "APPROVE" | "REJECT"): Promise<void> {
    if (!evaluation?.approval) return;
    setPhase("resolving");
    setError(null);
    try {
      const minimumWait = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 560;
      const [result] = await Promise.all([
        readApi<LabResolutionResult>(`/v1/lab/approvals/${evaluation.approval.id}`, { decision: action }),
        sleep(minimumWait)
      ]);
      setResolution(result);
      setPhase("resolved");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The approval could not be recorded");
      setPhase("error");
    }
  }

  async function copyReceipt(): Promise<void> {
    if (!evidence) return;
    const payload = {
      mode: "SYNTHETIC",
      authorizationId: resolution?.authorizationId ?? evaluation?.authorizationId,
      decision: resolution?.resolution ?? evaluation?.decision,
      request: resolution?.request ?? evaluation?.request,
      trace,
      evidence
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_800);
    } catch {
      setCopied(false);
    }
  }

  const packetStyle = { "--rail-stop": `${railStop}%` } as CSSProperties;

  return (
    <div className={`authority-lab authority-lab--${tone}`} data-phase={phase}>
      <div className="authority-lab__bar">
        <div className="authority-lab__live">
          <span className="authority-lab__live-dot" />
          <span>Policy engine connected</span>
          <span className="authority-lab__bar-muted">/ synthetic boundary</span>
        </div>
        <div className="authority-lab__bar-actions">
          <span>No sign-in · No persistence · No real execution</span>
          <button type="button" onClick={() => applyPreset(presets[1])} disabled={busy}>
            <RotateCcw size={12} /> Reset
          </button>
        </div>
      </div>

      <div className="authority-lab__workbench">
        <form className="lab-intent" onSubmit={(event) => void evaluate(event)}>
          <div className="lab-section-label">
            <span>01</span>
            <p>Compose agent intent</p>
          </div>

          <div className="lab-identity-lock">
            <Fingerprint size={17} />
            <div>
              <span>Requesting identity</span>
              <strong>procurement-agent</strong>
            </div>
            <LockKeyhole size={13} />
          </div>

          <fieldset className="lab-presets">
            <legend>Load a boundary test</legend>
            <div>
              {presets.map((preset, index) => (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={activePreset === preset.id}
                  onClick={() => applyPreset(preset)}
                  disabled={busy}
                >
                  <span>0{index + 1}</span>
                  <strong>{preset.label}</strong>
                  <em>{preset.expectation}</em>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="lab-field-grid">
            <label className="lab-field">
              <span>Capability</span>
              <select
                value={form.capability}
                onChange={(event) => {
                  setForm((current) => ({ ...current, capability: event.target.value }));
                  clearDecision();
                }}
                disabled={busy}
              >
                {capabilities.map((capability) => (
                  <option key={capability.id} value={capability.id}>
                    {capability.label} · {capability.status}
                  </option>
                ))}
              </select>
            </label>

            <label className="lab-field">
              <span>Vendor</span>
              <select
                value={form.vendor.id}
                onChange={(event) => {
                  const vendor = vendors.find((item) => item.id === event.target.value) ?? vendors[0];
                  setForm((current) => ({ ...current, vendor: { id: vendor.id, name: vendor.name } }));
                  clearDecision();
                }}
                disabled={busy}
              >
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name} · {vendor.status}
                  </option>
                ))}
              </select>
            </label>

            <label className="lab-field lab-field--amount">
              <span>Amount / USD</span>
              <div>
                <b aria-hidden="true">$</b>
                <input
                  required
                  inputMode="decimal"
                  pattern="(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,2})?"
                  value={form.amount.value}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, amount: { ...current.amount, value: event.target.value } }));
                    clearDecision();
                  }}
                  aria-label="Amount in US dollars"
                  disabled={busy}
                />
              </div>
            </label>

            <label className="lab-field lab-field--purpose">
              <span>Purpose</span>
              <textarea
                required
                minLength={3}
                maxLength={160}
                rows={3}
                value={form.purpose}
                onChange={(event) => {
                  setForm((current) => ({ ...current, purpose: event.target.value }));
                  clearDecision();
                }}
                disabled={busy}
              />
              <small aria-hidden="true">{form.purpose.length}/160</small>
            </label>
          </div>

          <button className="lab-evaluate" type="submit" disabled={busy}>
            {phase === "evaluating" ? <LoaderCircle className="lab-spinner" size={15} /> : <ArrowRight size={15} />}
            {phase === "evaluating" ? "Crossing the boundary" : "Run the decision"}
          </button>
          <p className="lab-intent__truth">Runs the real open-source evaluator against a fixed public-lab mandate.</p>
        </form>

        <section className="lab-output" aria-label="Authority evaluation">
          <div className="lab-section-label lab-section-label--rail">
            <span>02</span>
            <p>Cross the authority rail</p>
            <em>{evaluation?.authorizationId ? evaluation.authorizationId.slice(0, 23) : "awaiting_request"}</em>
          </div>

          <div className="lab-rail-viewport">
            <div className="lab-rail" aria-label="Policy evaluation trace">
              <div className="lab-rail__track" aria-hidden="true">
                <span className="lab-rail__progress" style={packetStyle} />
                <span className="lab-rail__packet" style={packetStyle}><ArrowRight size={10} /></span>
              </div>
              <div className="lab-rail__nodes" role="list">
                {idleRules.map((rule, index) => {
                  const step = trace.find((item) => item.rule === rule);
                  const result = step?.result.toLowerCase() ?? "idle";
                  const nodeStyle = { "--trace-delay": `${index * 48}ms` } as CSSProperties;
                  return (
                    <div key={rule} className="lab-rail__node" data-result={result} role="listitem" style={nodeStyle}>
                      <div className="lab-rail__marker">
                        <span>{step?.result === "PASS" ? "✓" : step?.result === "FAIL" ? "×" : step?.result === "REVIEW" ? "!" : ""}</span>
                      </div>
                      <p>{ruleLabels[rule]}</p>
                      <small>{step ? traceDetail(step) : "not evaluated"}</small>
                      <em>{step?.result ?? "WAIT"}</em>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="lab-consequence">
            <div className="lab-decision" aria-live="polite" aria-busy={busy}>
              <div className="lab-section-label">
                <span>03</span>
                <p>Consequence</p>
              </div>
              <div className="lab-decision__state">
                <span className="lab-decision__glyph" aria-hidden="true">
                  {busy ? <LoaderCircle className="lab-spinner" size={28} /> : decision.glyph}
                </span>
                <div>
                  <p className="lab-decision__word">
                    {busy ? "EVALUATING" : decision.label.split("\n").map((word) => <span key={word}>{word}</span>)}
                  </p>
                  <p className="lab-decision__reason">{busy ? "Nine gates. One deterministic outcome." : decision.reason}</p>
                </div>
              </div>
            </div>

            <aside className="lab-mandate">
              <div className="lab-mandate__head">
                <ShieldCheck size={16} />
                <div><span>Active mandate / v3</span><strong>Bounded compute</strong></div>
              </div>
              <dl>
                <div><dt>Capabilities</dt><dd>compute · API</dd></div>
                <div><dt>Vendors</dt><dd>OpenAI · Anthropic · AWS</dd></div>
                <div><dt>Per action</dt><dd>$150.00</dd></div>
                <div><dt>Human above</dt><dd>$100.00</dd></div>
                <div><dt>Today</dt><dd>$42.80 / $200.00</dd></div>
              </dl>
            </aside>
          </div>

          {evaluation?.decision === "REQUIRE_APPROVAL" && !resolution && !error && (
            <div className="lab-approval" aria-live="polite">
              <div className="lab-approval__copy">
                <LockKeyhole size={18} />
                <div>
                  <span>Human boundary reached</span>
                  <strong>Approve this exact ${evaluation.request.amount.value} request—or stop it.</strong>
                  <p>One decision. One request. Expires in ten minutes.</p>
                </div>
              </div>
              <div className="lab-approval__actions">
                <button type="button" onClick={() => void resolveApproval("REJECT")} disabled={busy}>
                  <X size={14} /> Reject
                </button>
                <button type="button" onClick={() => void resolveApproval("APPROVE")} disabled={busy}>
                  {phase === "resolving" ? <LoaderCircle className="lab-spinner" size={14} /> : <Check size={14} />}
                  Approve exact request
                </button>
              </div>
            </div>
          )}

          <div className="lab-evidence">
            <div className="lab-evidence__head">
              <div>
                <span>04 / Evidence receipt</span>
                <strong>{evidence ? evidence.receiptId : "Created after a decision"}</strong>
              </div>
              <button type="button" onClick={() => void copyReceipt()} disabled={!evidence}>
                <Clipboard size={12} /> {copied ? "Copied" : "Copy JSON"}
              </button>
            </div>
            <div className="lab-evidence__digest">
              <span>SHA-256 evidence digest</span>
              <code>{evidence?.digest ?? "—".repeat(64)}</code>
            </div>
            <ol className="lab-evidence__events">
              {(evidence?.events ?? []).map((event) => (
                <li key={`${event.sequence}-${event.type}`}>
                  <span>{String(event.sequence).padStart(2, "0")}</span>
                  <div><strong>{event.type.replaceAll("_", " ")}</strong><small>{event.actor}</small></div>
                </li>
              ))}
              {!evidence && (
                <li className="lab-evidence__empty">
                  <Gauge size={14} /> The decision sequence will land here.
                </li>
              )}
            </ol>
          </div>

          {evaluation && !error && (
            <div className="lab-next-boundary">
              <div>
                <span>05 / Next boundary</span>
                <strong>This decision was synthetic. Bring the action that is actually consequential.</strong>
                <p>Shape one real mandate, human line and evidence path with CAPYN.</p>
              </div>
              <Link href="/design-partners">
                Bring a real boundary <ArrowRight size={13} />
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
