"use client";

import type {
  ApiErrorBody,
  LabEvaluateRequest,
  SandboxActivationResult,
  SandboxEvaluationResult
} from "@capyn/types";
import { gsap } from "gsap";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clipboard,
  Clock3,
  Code2,
  Download,
  Eye,
  EyeOff,
  FileCheck2,
  Fingerprint,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  TerminalSquare,
  TriangleAlert
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ProductionLaunch } from "@/components/public/production-launch";
import { createLabProofBundle, createLabProofHref } from "@/lib/lab-proof";
import {
  createSandboxActivationRequest,
  createSandboxCurl,
  createSandboxDraft,
  createSandboxRequest,
  createSandboxScenarios,
  isSandboxStageValid,
  sandboxCapabilities,
  slugifySandboxName,
  validateSandboxDraft,
  type SandboxActivationDraft,
  type SandboxDraftField,
  type SandboxEditableStage,
  type SandboxStage
} from "@/lib/sandbox-activation";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

const stages = [
  { id: "workspace", number: "01", label: "Workspace", note: "Name the operating context" },
  { id: "agent", number: "02", label: "Agent", note: "Bind one machine identity" },
  { id: "mandate", number: "03", label: "Mandate", note: "Draw its authority boundary" },
  { id: "credential", number: "04", label: "Credential", note: "Issue an expiring bearer" },
  { id: "decision", number: "05", label: "Decision", note: "Cross the policy engine" },
  { id: "proof", number: "06", label: "Proof", note: "Carry the evidence away" }
] as const satisfies ReadonlyArray<{ id: SandboxStage; number: string; label: string; note: string }>;

const editableOrder: SandboxEditableStage[] = ["workspace", "agent", "mandate"];
type BusyAction = "activate" | "authorize" | null;
type CopyTarget = "credential" | "curl" | "proof" | "digest" | null;

async function postApi<T>(path: string, body: unknown, credential?: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(credential ? { Authorization: `Bearer ${credential}` } : {})
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });
  let payload: T | ApiErrorBody;
  try {
    payload = await response.json() as T | ApiErrorBody;
  } catch {
    throw new Error("The commissioning service returned an unreadable response.");
  }
  if (!response.ok) {
    const apiError = payload as ApiErrorBody;
    throw new Error(apiError.error?.message ?? "The commissioning service could not complete this request.");
  }
  return payload as T;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function maskCredential(value: string): string {
  return `${value.slice(0, 16)}${"•".repeat(28)}${value.slice(-7)}`;
}

function countdown(seconds: number): string {
  const bounded = Math.max(0, seconds);
  const minutes = Math.floor(bounded / 60).toString().padStart(2, "0");
  const remainder = (bounded % 60).toString().padStart(2, "0");
  return `00:${minutes}:${remainder}`;
}

function titleCaseRule(value: string): string {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

function decisionCopy(result: SandboxEvaluationResult) {
  if (result.decision === "ALLOW") {
    return {
      headline: "Allowed to proceed.",
      copy: "Identity, scope, vendor, limits and the human line all passed. The synthetic executor received this exact action."
    };
  }
  if (result.decision === "REQUIRE_APPROVAL") {
    return {
      headline: "Stopped for a human.",
      copy: "The hard rules passed, but this amount crossed the mandate’s review line. No execution occurred."
    };
  }
  return {
    headline: "Stopped before consequence.",
    copy: "At least one hard rule failed. The request did not reach the synthetic execution boundary."
  };
}

export function SandboxCommissioning() {
  const [draft, setDraft] = useState<SandboxActivationDraft>(() => createSandboxDraft());
  const [stage, setStage] = useState<SandboxStage>("workspace");
  const [activation, setActivation] = useState<SandboxActivationResult | null>(null);
  const [result, setResult] = useState<SandboxEvaluationResult | null>(null);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [credentialVisible, setCredentialVisible] = useState(false);
  const [copied, setCopied] = useState<CopyTarget>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(30 * 60);
  const [selectedScenario, setSelectedScenario] = useState("inside");
  const [productionLaunchOpen, setProductionLaunchOpen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const workfaceRef = useRef<HTMLElement>(null);
  const alignmentTimerRef = useRef<number | null>(null);
  const slugEdited = useRef(false);

  const stageIndex = stages.findIndex((item) => item.id === stage);
  const errors = useMemo(() => validateSandboxDraft(draft), [draft]);
  const scenarios = useMemo(() => createSandboxScenarios(draft), [draft]);
  const proofBundle = useMemo(
    () => result ? createLabProofBundle(result.authorizationId, result.request, result.evidence) : null,
    [result]
  );
  const proofHref = useMemo(() => proofBundle ? createLabProofHref(proofBundle) : null, [proofBundle]);
  const curl = useMemo(
    () => createSandboxCurl(API_BASE, activation?.firstRequest ?? createSandboxRequest(draft)),
    [activation, draft]
  );

  useEffect(() => {
    if (!activation) return;
    function tick(): void {
      setSecondsRemaining(Math.max(0, Math.ceil((Date.parse(activation!.credential.expiresAt) - Date.now()) / 1_000)));
    }
    tick();
    const interval = window.setInterval(tick, 1_000);
    return () => window.clearInterval(interval);
  }, [activation]);

  useEffect(() => () => {
    if (alignmentTimerRef.current !== null) window.clearTimeout(alignmentTimerRef.current);
  }, []);

  useLayoutEffect(() => {
    if (!rootRef.current) return;
    const media = gsap.matchMedia();
    media.add(
      {
        reduceMotion: "(prefers-reduced-motion: reduce)",
        motionAllowed: "(prefers-reduced-motion: no-preference)"
      },
      (context) => {
        const reveals = rootRef.current?.querySelectorAll("[data-commission-reveal]") ?? [];
        const activeContact = rootRef.current?.querySelector("[data-contact='active'] .commission-contact__pin");
        if (context.conditions?.reduceMotion) {
          gsap.set(reveals, { clearProps: "all" });
          return;
        }
        const timeline = gsap.timeline({ defaults: { ease: "power3.out" } })
          .fromTo(reveals, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, duration: 0.38, stagger: 0.045, y: 0 });
        if (activeContact) {
          timeline.fromTo(activeContact, { boxShadow: "0 0 0 0 rgba(155,94,60,0)" }, { boxShadow: "0 0 0 8px rgba(155,94,60,.13)", duration: 0.42 }, 0.08);
        }
      },
      rootRef
    );
    return () => media.revert();
  }, [stage, result?.authorizationId]);

  function update(field: SandboxDraftField, value: string): void {
    setDraft((current) => ({ ...current, [field]: value }));
    setError(null);
  }

  function updateAgentName(value: string): void {
    setDraft((current) => ({
      ...current,
      agentName: value,
      ...(slugEdited.current ? {} : { agentSlug: slugifySandboxName(value) })
    }));
    setError(null);
  }

  function goToStage(next: SandboxStage): void {
    setStage(next);
    if (alignmentTimerRef.current !== null) {
      window.clearTimeout(alignmentTimerRef.current);
      alignmentTimerRef.current = null;
    }
    if (next === "workspace") return;
    alignmentTimerRef.current = window.setTimeout(() => {
      if (!workfaceRef.current) return;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const headerHeight = document.querySelector<HTMLElement>(".public-header")?.getBoundingClientRect().height ?? 72;
      const top = workfaceRef.current.getBoundingClientRect().top + window.scrollY - headerHeight - 16;
      window.scrollTo({ behavior: reducedMotion ? "auto" : "smooth", top });
      alignmentTimerRef.current = null;
    }, 180);
  }

  function moveEditable(direction: 1 | -1): void {
    const index = editableOrder.indexOf(stage as SandboxEditableStage);
    if (index < 0) return;
    if (direction === 1 && !isSandboxStageValid(draft, editableOrder[index]!)) {
      setShowErrors(true);
      return;
    }
    const next = editableOrder[index + direction];
    if (!next) return;
    setShowErrors(false);
    setError(null);
    goToStage(next);
  }

  async function commission(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!isSandboxStageValid(draft, "mandate")) {
      setShowErrors(true);
      return;
    }
    setBusy("activate");
    setError(null);
    try {
      const minimumWait = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 640;
      const [issued] = await Promise.all([
        postApi<SandboxActivationResult>("/v1/sandbox/activate", createSandboxActivationRequest(draft)),
        sleep(minimumWait)
      ]);
      setActivation(issued);
      setSecondsRemaining(Math.max(0, Math.ceil((Date.parse(issued.credential.expiresAt) - Date.now()) / 1_000)));
      goToStage("credential");
      setShowErrors(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The sandbox credential could not be issued.");
    } finally {
      setBusy(null);
    }
  }

  async function authorize(scenarioId = selectedScenario): Promise<void> {
    if (!activation || secondsRemaining <= 0) {
      setError("This credential has expired. Clear the session and commission a fresh one.");
      return;
    }
    const scenario = scenarios.find((item) => item.id === scenarioId) ?? scenarios[0];
    setSelectedScenario(scenario.id);
    setBusy("authorize");
    setError(null);
    try {
      const request: LabEvaluateRequest = { ...activation.firstRequest, amount: { value: scenario.amount, currency: "USD" } };
      const minimumWait = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 720;
      const [evaluation] = await Promise.all([
        postApi<SandboxEvaluationResult>("/v1/sandbox/authorize", request, activation.credential.apiKey),
        sleep(minimumWait)
      ]);
      setResult(evaluation);
      goToStage("decision");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The first authorization could not be evaluated.");
    } finally {
      setBusy(null);
    }
  }

  async function copyText(target: Exclude<CopyTarget, null>, value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(target);
      window.setTimeout(() => setCopied(null), 1_800);
    } catch {
      setError("Clipboard access was blocked. Select and copy the value manually.");
    }
  }

  function downloadProof(): void {
    if (!proofBundle) return;
    const blob = new Blob([JSON.stringify(proofBundle, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `capyn-proof-${proofBundle.authorizationId}.json`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  function clearSession(): void {
    setDraft(createSandboxDraft());
    goToStage("workspace");
    setActivation(null);
    setResult(null);
    setError(null);
    setShowErrors(false);
    setCredentialVisible(false);
    setCopied(null);
    setSecondsRemaining(30 * 60);
    setSelectedScenario("inside");
    setProductionLaunchOpen(false);
    slugEdited.current = false;
  }

  const decision = result ? decisionCopy(result) : null;
  const resultTone = result?.decision === "ALLOW" ? "permission" : result?.decision === "REQUIRE_APPROVAL" ? "review" : "denial";

  if (productionLaunchOpen && activation) {
    return (
      <ProductionLaunch
        activation={activation}
        sandboxCredential={activation.credential.apiKey}
        onBack={() => setProductionLaunchOpen(false)}
      />
    );
  }

  return (
    <main ref={rootRef} className="commissioning-page">
      <section className="commissioning-hero">
        <div className="commissioning-hero__grid" aria-hidden="true" />
        <div className="site-container commissioning-hero__inner">
          <div className="commissioning-hero__copy enter-control">
            <p className="commission-kicker"><span /> LIVE COMMISSIONING / SYNTHETIC SANDBOX</p>
            <h1 className="display-title">Commission an agent.<br /><em>Watch authority become real.</em></h1>
            <p className="commissioning-hero__lede">Create a workspace, bind one agent, issue an expiring credential and send its first authenticated action through CAPYN. No signup. No pretend result.</p>
          </div>
          <aside className="commissioning-hero__plate enter-control" aria-label="Sandbox boundaries">
            <div><span>SESSION</span><strong>30 MIN</strong></div>
            <div><span>POLICY</span><strong>REAL ENGINE</strong></div>
            <div><span>EXECUTION</span><strong>SYNTHETIC</strong></div>
            <p><LockKeyhole size={13} /> Credential lives in this tab only</p>
          </aside>
        </div>
      </section>

      <section className="commissioning-section" aria-label="Agent commissioning workbench">
        <div className="site-container">
          <div className="commission-bay">
            <header className="commission-bay__head">
              <div><span className="commission-live-dot" /><p>CAPYN / COMMISSIONING BAY 01</p><code>STATELESS_SANDBOX</code></div>
              <div><span>AES-256-GCM CREDENTIAL</span><span>ZERO PERSISTENCE</span><span>MOCK EXECUTION</span></div>
            </header>

            <div className="commission-bay__body">
              <aside className="commission-rail" aria-label="Commissioning progress">
                <div className="commission-rail__line" aria-hidden="true"><span style={{ height: `${(stageIndex / (stages.length - 1)) * 100}%` }} /></div>
                <ol>
                  {stages.map((item, index) => {
                    const state = index < stageIndex ? "complete" : index === stageIndex ? "active" : "pending";
                    return (
                      <li key={item.id} className="commission-contact" data-contact={state} aria-current={state === "active" ? "step" : undefined}>
                        <span className="commission-contact__pin">{state === "complete" ? <Check size={12} /> : item.number}</span>
                        <p><strong>{item.label}</strong><small>{item.note}</small></p>
                      </li>
                    );
                  })}
                </ol>
              </aside>

              <section ref={workfaceRef} className="commission-workface">
                {stage === "workspace" && (
                  <div className="commission-stage" data-commission-reveal>
                    <StageHeading number="01" eyebrow="Operating context" title="Where does this agent report?" copy="This names the ephemeral workspace carried inside the sandbox credential. Nothing is written to a customer database." />
                    <form onSubmit={(event) => { event.preventDefault(); moveEditable(1); }}>
                      <CommissionField label="Organisation name" error={showErrors ? errors.organisationName : undefined}>
                        <input value={draft.organisationName} onChange={(event) => update("organisationName", event.target.value)} maxLength={120} aria-invalid={showErrors && Boolean(errors.organisationName)} />
                      </CommissionField>
                      <div className="commission-stage__preview">
                        <span>EPHEMERAL WORKSPACE</span><strong>{draft.organisationName || "Unnamed workspace"}</strong><code>id assigned when mandate is sealed</code>
                      </div>
                      <StageActions primary="Bind an agent" onPrimary={() => moveEditable(1)} />
                    </form>
                  </div>
                )}

                {stage === "agent" && (
                  <div className="commission-stage" data-commission-reveal>
                    <StageHeading number="02" eyebrow="Machine identity" title="Who is asking to act?" copy="CAPYN derives this identity from the bearer credential. The authorization body cannot substitute another agent ID." />
                    <form onSubmit={(event) => { event.preventDefault(); moveEditable(1); }}>
                      <div className="commission-field-grid">
                        <CommissionField label="Agent display name" error={showErrors ? errors.agentName : undefined}>
                          <input value={draft.agentName} onChange={(event) => updateAgentName(event.target.value)} maxLength={120} aria-invalid={showErrors && Boolean(errors.agentName)} />
                        </CommissionField>
                        <CommissionField label="Stable slug" hint="Lowercase, URL-safe identity" error={showErrors ? errors.agentSlug : undefined}>
                          <input value={draft.agentSlug} onChange={(event) => { slugEdited.current = true; update("agentSlug", event.target.value.toLowerCase()); }} maxLength={100} spellCheck={false} aria-invalid={showErrors && Boolean(errors.agentSlug)} />
                        </CommissionField>
                      </div>
                      <div className="commission-identity-card">
                        <Fingerprint size={22} />
                        <p><span>REQUESTING PRINCIPAL</span><strong>{draft.agentName || "Unnamed agent"}</strong><code>{draft.agentSlug || "unbound"} / status: active</code></p>
                        <LockKeyhole size={15} />
                      </div>
                      <StageActions secondary="Workspace" primary="Draw the mandate" onSecondary={() => moveEditable(-1)} onPrimary={() => moveEditable(1)} />
                    </form>
                  </div>
                )}

                {stage === "mandate" && (
                  <div className="commission-stage commission-stage--mandate" data-commission-reveal>
                    <StageHeading number="03" eyebrow="Authority envelope" title="Draw the line before the action." copy="Grant one capability, one vendor and explicit limits. The first action will be evaluated against this exact sealed boundary." />
                    <form onSubmit={(event) => void commission(event)}>
                      <CommissionField label="Mandate name" error={showErrors ? errors.mandateName : undefined}>
                        <input value={draft.mandateName} onChange={(event) => update("mandateName", event.target.value)} maxLength={120} aria-invalid={showErrors && Boolean(errors.mandateName)} />
                      </CommissionField>

                      <fieldset className="commission-capabilities">
                        <legend>Granted capability <span>Every other capability fails closed.</span></legend>
                        <div>
                          {sandboxCapabilities.map((capability) => (
                            <label key={capability.id} className={draft.capability === capability.id ? "is-selected" : ""}>
                              <input type="radio" name="capability" value={capability.id} checked={draft.capability === capability.id} onChange={(event) => update("capability", event.target.value)} />
                              <span>{draft.capability === capability.id ? <Check size={12} /> : null}</span>
                              <p><strong>{capability.label}</strong><code>{capability.id}</code><small>{capability.note}</small></p>
                            </label>
                          ))}
                        </div>
                      </fieldset>

                      <div className="commission-block">
                        <div className="commission-block__label"><span>APPROVED COUNTERPARTY</span><p>Unknown vendors are denied before spend checks.</p></div>
                        <div className="commission-field-grid">
                          <CommissionField label="Vendor name" error={showErrors ? errors.vendorName : undefined}>
                            <input value={draft.vendorName} onChange={(event) => { update("vendorName", event.target.value); if (event.target.value) update("vendorId", slugifySandboxName(event.target.value)); }} maxLength={160} />
                          </CommissionField>
                          <CommissionField label="Vendor ID" error={showErrors ? errors.vendorId : undefined}>
                            <input value={draft.vendorId} onChange={(event) => update("vendorId", event.target.value.toLowerCase())} maxLength={100} spellCheck={false} />
                          </CommissionField>
                        </div>
                      </div>

                      <div className="commission-block">
                        <div className="commission-block__label"><span>LIMIT STACK / USD</span><p>Human line &lt; hard ceiling ≤ day ≤ month.</p></div>
                        <div className="commission-money-grid">
                          <CommissionMoneyField label="Human above" value={draft.approvalAbove} error={showErrors ? errors.approvalAbove : undefined} onChange={(value) => update("approvalAbove", value)} />
                          <CommissionMoneyField label="Hard per action" value={draft.perTransaction} error={showErrors ? errors.perTransaction : undefined} onChange={(value) => update("perTransaction", value)} />
                          <CommissionMoneyField label="UTC day" value={draft.daily} error={showErrors ? errors.daily : undefined} onChange={(value) => update("daily", value)} />
                          <CommissionMoneyField label="Calendar month" value={draft.monthly} error={showErrors ? errors.monthly : undefined} onChange={(value) => update("monthly", value)} />
                        </div>
                      </div>

                      <div className="commission-block commission-block--intent">
                        <div className="commission-block__label"><span>FIRST EXACT ACTION</span><p>This request ships with the commissioning packet.</p></div>
                        <div className="commission-field-grid commission-field-grid--intent">
                          <CommissionMoneyField label="Amount" value={draft.firstAmount} error={showErrors ? errors.firstAmount : undefined} onChange={(value) => update("firstAmount", value)} />
                          <CommissionField label="Purpose" error={showErrors ? errors.purpose : undefined}>
                            <textarea value={draft.purpose} onChange={(event) => update("purpose", event.target.value)} rows={3} maxLength={160} />
                          </CommissionField>
                        </div>
                      </div>

                      {error && <CommissionError message={error} />}
                      <StageActions secondary="Agent" primary={busy === "activate" ? "Sealing authority…" : "Seal mandate + issue key"} onSecondary={() => moveEditable(-1)} submit busy={busy === "activate"} />
                    </form>
                  </div>
                )}

                {stage === "credential" && activation && (
                  <div className="commission-stage commission-stage--credential" data-commission-reveal>
                    <StageHeading number="04" eyebrow="Credential issued" title="One key. One bounded identity." copy="This encrypted bearer carries the workspace, agent and mandate. It is shown once, kept only in this tab and expires automatically." />
                    <div className="credential-instrument">
                      <header><div><KeyRound size={16} /><span>CAPYN SANDBOX BEARER</span></div><p className={secondsRemaining > 0 ? "" : "is-expired"}><Clock3 size={13} /> {secondsRemaining > 0 ? `EXPIRES IN ${countdown(secondsRemaining)}` : "EXPIRED"}</p></header>
                      <div className="credential-instrument__key">
                        <code>{credentialVisible ? activation.credential.apiKey : maskCredential(activation.credential.apiKey)}</code>
                        <div>
                          <button type="button" onClick={() => setCredentialVisible((visible) => !visible)}>{credentialVisible ? <EyeOff size={13} /> : <Eye size={13} />}{credentialVisible ? "Hide" : "Reveal"}</button>
                          <button type="button" onClick={() => void copyText("credential", activation.credential.apiKey)}><Clipboard size={13} />{copied === "credential" ? "Copied" : "Copy key"}</button>
                        </div>
                      </div>
                      <dl>
                        <div><dt>Bound principal</dt><dd>{activation.agent.slug}</dd></div>
                        <div><dt>Capability</dt><dd>{activation.mandate.capabilities[0]}</dd></div>
                        <div><dt>Key prefix</dt><dd>{activation.credential.keyPrefix}…</dd></div>
                        <div><dt>Storage</dt><dd>none / stateless</dd></div>
                      </dl>
                    </div>
                    <div className="credential-warning"><TriangleAlert size={16} /><p><strong>Treat it like a password for the next 30 minutes.</strong><span>Do not paste it into source control. Refreshing or clearing this page discards your only browser copy.</span></p></div>
                    <div className="commission-code">
                      <header><div><TerminalSquare size={13} /> FIRST AUTHORIZATION / CURL</div><button type="button" onClick={() => void copyText("curl", curl)}><Clipboard size={12} />{copied === "curl" ? "Copied" : "Copy"}</button></header>
                      <pre><code>{curl}</code></pre>
                    </div>
                    {error && <CommissionError message={error} />}
                    <div className="commission-stage__actions commission-stage__actions--credential">
                      <button type="button" className="is-quiet" onClick={clearSession}><RotateCcw size={14} /> Clear session</button>
                      <button type="button" className="is-primary" disabled={busy === "authorize" || secondsRemaining <= 0} onClick={() => void authorize("inside")}>
                        {busy === "authorize" ? <LoaderCircle className="commission-spinner" size={14} /> : <ArrowRight size={14} />}{busy === "authorize" ? "Crossing policy engine…" : "Run first authenticated decision"}
                      </button>
                    </div>
                  </div>
                )}

                {stage === "decision" && result && decision && (
                  <div className={`commission-stage commission-stage--decision commission-stage--${resultTone}`} data-commission-reveal>
                    <StageHeading number="05" eyebrow="Policy engine returned" title={decision.headline} copy={decision.copy} />
                    <div className="decision-instrument">
                      <div className="decision-instrument__verdict"><span>DECISION / {result.outcome}</span><strong>{result.decision === "REQUIRE_APPROVAL" ? "HUMAN REQUIRED" : result.decision}</strong><p>{result.reasonCodes.join(" · ")}</p></div>
                      <div className="decision-instrument__request"><span>EXACT REQUEST</span><strong>${result.request.amount.value} → {result.request.vendor.name}</strong><code>{result.request.capability} / {result.agent.slug}</code></div>
                    </div>

                    <div className="commission-trace" aria-label="Policy trace">
                      <header><span>NINE-GATE TRACE</span><p>{result.trace.filter((step) => step.result === "PASS").length} passed / {result.trace.length} evaluated</p></header>
                      <ol>
                        {result.trace.map((step, index) => (
                          <li key={`${step.rule}-${index}`} data-result={step.result.toLowerCase()}>
                            <span>{step.result === "PASS" ? <Check size={11} /> : step.result === "REVIEW" ? "!" : "×"}</span>
                            <p><strong>{titleCaseRule(step.rule)}</strong><small>{step.reasonCode.replaceAll("_", " ")}</small></p>
                            <em>{step.result}</em>
                          </li>
                        ))}
                      </ol>
                    </div>

                    <fieldset className="commission-scenarios">
                      <legend>Stress the same sealed boundary <span>The credential and mandate do not change.</span></legend>
                      <div>
                        {scenarios.map((scenario) => (
                          <button key={scenario.id} type="button" aria-pressed={selectedScenario === scenario.id} disabled={busy === "authorize"} onClick={() => void authorize(scenario.id)}>
                            <span>{scenario.expectation}</span><strong>{scenario.label}</strong><small>${scenario.amount}</small>
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    {error && <CommissionError message={error} />}
                    <div className="commission-stage__actions">
                      <button type="button" className="is-quiet" onClick={() => goToStage("credential")}><ArrowLeft size={14} /> Credential</button>
                      <button type="button" className="is-primary" onClick={() => goToStage("proof")}><FileCheck2 size={14} /> Inspect evidence proof</button>
                    </div>
                  </div>
                )}

                {stage === "proof" && result && proofBundle && proofHref && (
                  <div className="commission-stage commission-stage--proof" data-commission-reveal>
                    <StageHeading number="06" eyebrow="Evidence receipt" title="The decision can leave with you." copy="CAPYN bound the exact request and ordered events into a SHA-256-covered receipt. The public viewer recomputes that digest in your browser." />
                    <div className="proof-instrument">
                      <header><div><ShieldCheck size={17} /><p><span>RECEIPT SEALED</span><strong>{result.evidence.receiptId}</strong></p></div><em>SHA-256</em></header>
                      <div className="proof-instrument__digest"><span>CANONICAL DIGEST</span><code>{result.evidence.digest}</code><button type="button" onClick={() => void copyText("digest", result.evidence.digest)}><Clipboard size={12} />{copied === "digest" ? "Copied" : "Copy"}</button></div>
                      <ol>
                        {result.evidence.events.map((event) => (
                          <li key={event.sequence}><span>{String(event.sequence).padStart(2, "0")}</span><p><strong>{event.type.replaceAll("_", " ")}</strong><small>{event.actor} · {event.detail}</small></p><time>{new Date(event.timestamp).toISOString().slice(11, 23)}</time></li>
                        ))}
                      </ol>
                    </div>
                    <div className="proof-actions">
                      <Link href={proofHref} target="_blank"><FileCheck2 size={14} /> Open independent viewer</Link>
                      <button type="button" onClick={() => void copyText("proof", new URL(proofHref, window.location.origin).toString())}><Clipboard size={14} />{copied === "proof" ? "Link copied" : "Copy proof link"}</button>
                      <button type="button" onClick={downloadProof}><Download size={14} /> Download JSON</button>
                    </div>
                    <div className="commission-proof-next">
                      <div><Code2 size={17} /><p><strong>You completed the full trust loop.</strong><span>Identity → mandate → credential → decision → portable proof. Production workspaces add persistence, revocation, approvals and execution adapters.</span></p></div>
                      <button type="button" onClick={() => setProductionLaunchOpen(true)}>Create a durable workspace <ArrowRight size={14} /></button>
                    </div>
                    <div className="commission-stage__actions">
                      <button type="button" className="is-quiet" onClick={() => goToStage("decision")}><ArrowLeft size={14} /> Decision</button>
                      <button type="button" className="is-primary" onClick={clearSession}><RotateCcw size={14} /> Commission another agent</button>
                    </div>
                  </div>
                )}
              </section>

              <aside className="commission-register" aria-label="Live commissioning register">
                <header><span>LIVE ARTIFACT REGISTER</span><code>{String(stageIndex + 1).padStart(2, "0")}/{stages.length.toString().padStart(2, "0")}</code></header>
                <dl>
                  <RegisterRow label="Workspace" value={activation?.workspace.name ?? draft.organisationName} state={stageIndex >= 1 ? "set" : "editing"} />
                  <RegisterRow label="Agent" value={activation?.agent.slug ?? draft.agentSlug} state={stageIndex >= 2 ? "bound" : stageIndex === 1 ? "editing" : "waiting"} />
                  <RegisterRow label="Mandate" value={activation?.mandate.name ?? draft.mandateName} state={activation ? "sealed" : stageIndex === 2 ? "editing" : "waiting"} />
                  <RegisterRow label="Credential" value={activation ? `${activation.credential.keyPrefix}…` : "not issued"} state={activation ? (secondsRemaining > 0 ? "live" : "expired") : "waiting"} />
                  <RegisterRow label="Decision" value={result?.decision ?? "not evaluated"} state={result ? result.decision.toLowerCase() : "waiting"} />
                  <RegisterRow label="Receipt" value={result?.evidence.receiptId ?? "not sealed"} state={stage === "proof" ? "portable" : result ? "ready" : "waiting"} />
                </dl>
                <div className="commission-register__boundary"><ShieldCheck size={15} /><p><strong>Synthetic by design</strong><span>No account, customer data, funds or spend state is created in this commissioning session.</span></p></div>
              </aside>
            </div>
          </div>
          <p className="commissioning-disclosure"><LockKeyhole size={12} /> Public sandbox only. Credentials are encrypted, stateless and expire after 30 minutes. Execution is simulated; no funds move.</p>
        </div>
      </section>
    </main>
  );
}

function StageHeading({ number, eyebrow, title, copy }: { number: string; eyebrow: string; title: string; copy: string }) {
  return (
    <header className="commission-stage__heading">
      <div><span>{number}</span><p>{eyebrow}</p></div>
      <h2 className="display-title">{title}</h2>
      <p>{copy}</p>
    </header>
  );
}

function CommissionField({ label, hint, error, children }: { label: string; hint?: string | undefined; error?: string | undefined; children: React.ReactNode }) {
  return (
    <label className="commission-field">
      <span>{label}{hint && <small>{hint}</small>}</span>
      {children}
      {error && <em><TriangleAlert size={11} />{error}</em>}
    </label>
  );
}

function CommissionMoneyField({ label, value, error, onChange }: { label: string; value: string; error?: string | undefined; onChange: (value: string) => void }) {
  return (
    <label className="commission-money-field">
      <span>{label}</span>
      <div><i>$</i><input value={value} inputMode="decimal" onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} /><code>USD</code></div>
      {error && <em><TriangleAlert size={11} />{error}</em>}
    </label>
  );
}

function StageActions({ secondary, primary, onSecondary, onPrimary, submit = false, busy = false }: { secondary?: string; primary: string; onSecondary?: () => void; onPrimary?: () => void; submit?: boolean; busy?: boolean }) {
  return (
    <div className="commission-stage__actions">
      {secondary ? <button type="button" className="is-quiet" onClick={onSecondary}><ArrowLeft size={14} /> {secondary}</button> : <span />}
      <button type={submit ? "submit" : "button"} className="is-primary" onClick={submit ? undefined : onPrimary} disabled={busy}>
        {busy ? <LoaderCircle className="commission-spinner" size={14} /> : <ArrowRight size={14} />}{primary}
      </button>
    </div>
  );
}

function CommissionError({ message }: { message: string }) {
  return <div className="commission-error" role="alert"><TriangleAlert size={15} /><p><strong>Commissioning interrupted</strong><span>{message}</span></p></div>;
}

function RegisterRow({ label, value, state }: { label: string; value: string; state: string }) {
  return <div><dt>{label}<span>{state}</span></dt><dd title={value}>{value}</dd></div>;
}
