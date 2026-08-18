"use client";

import { PLAN_CATALOG } from "@capyn/billing";
import type {
  ApiErrorBody,
  ProductionLaunchResult,
  SandboxActivationResult
} from "@capyn/types";
import { gsap } from "gsap";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clipboard,
  CreditCard,
  Database,
  Download,
  Eye,
  EyeOff,
  Fingerprint,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  TriangleAlert,
  UserRoundCheck
} from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  OWNER_SESSION_STORAGE_KEY,
  createProductionLaunchDraft,
  createProductionLaunchRequest,
  createProductionRecoveryBundle,
  maskProductionCredential,
  slugifyProductionWorkspace,
  validateProductionLaunchDraft,
  type ProductionLaunchDraft,
  type ProductionLaunchField
} from "@/lib/production-launch";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

const launchStages = [
  { id: "custodian", number: "01", label: "Custodian", note: "Bind accountable ownership" },
  { id: "plan", number: "02", label: "Service rail", note: "Choose the hosted boundary" },
  { id: "commit", number: "03", label: "Commit", note: "Write the durable ledger" },
  { id: "recovery", number: "04", label: "Recovery", note: "Take custody of both keys" }
] as const;

type LaunchStage = (typeof launchStages)[number]["id"];
type CopyTarget = "owner" | "agent" | null;

const plans = (["DEVELOPER", "TEAM", "BUSINESS"] as const).map((id) => ({
  ...PLAN_CATALOG[id],
  price: id === "DEVELOPER" ? "$0" : `$${(PLAN_CATALOG[id].basePriceCents / 100).toFixed(0)}`,
  signal: id === "DEVELOPER" ? "ACTIVE NOW" : id === "TEAM" ? "HOSTED" : "OPERATIONS"
}));

async function launchWorkspace(
  sandboxCredential: string,
  idempotencyKey: string,
  draft: ProductionLaunchDraft
): Promise<ProductionLaunchResult> {
  const response = await fetch(`${API_BASE}/v1/onboarding/launch`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sandboxCredential}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey
    },
    body: JSON.stringify(createProductionLaunchRequest(draft)),
    cache: "no-store"
  });
  const payload = await response.json().catch(() => null) as ProductionLaunchResult | ApiErrorBody | null;
  if (!response.ok || !payload || "error" in payload) {
    throw new Error(
      payload && "error" in payload
        ? payload.error.message
        : "The durable workspace service returned an unreadable response."
    );
  }
  return payload;
}

function inputError(
  errors: Partial<Record<ProductionLaunchField, string>>,
  field: ProductionLaunchField,
  showErrors: boolean
): string | undefined {
  return showErrors ? errors[field] : undefined;
}

function persistenceCopy(persistence: ProductionLaunchResult["workspace"]["persistence"] | undefined): string {
  if (persistence === "POSTGRESQL") return "durable PostgreSQL records";
  if (persistence === "VOLUME_JOURNAL") return "a durable single-service volume journal";
  if (persistence === "PROCESS_MEMORY") return "a local process-memory rehearsal";
  return "a durable tenant repository";
}

export function ProductionLaunch({
  activation,
  sandboxCredential,
  onBack
}: {
  activation: SandboxActivationResult;
  sandboxCredential: string;
  onBack: () => void;
}) {
  const [stage, setStage] = useState<LaunchStage>("custodian");
  const [draft, setDraft] = useState(() => createProductionLaunchDraft(activation));
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProductionLaunchResult | null>(null);
  const [ownerVisible, setOwnerVisible] = useState(false);
  const [agentVisible, setAgentVisible] = useState(false);
  const [copied, setCopied] = useState<CopyTarget>(null);
  const [custody, setCustody] = useState({ owner: false, agent: false, bundle: false });
  const [slugEdited, setSlugEdited] = useState(false);
  const idempotencyKey = useRef<string | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const errors = useMemo(() => validateProductionLaunchDraft(draft), [draft]);
  const stageIndex = launchStages.findIndex((item) => item.id === stage);
  const custodyComplete = custody.bundle || (custody.owner && custody.agent);

  useLayoutEffect(() => {
    if (!rootRef.current) return;
    const media = gsap.matchMedia();
    media.add(
      {
        reduceMotion: "(prefers-reduced-motion: reduce)",
        motionAllowed: "(prefers-reduced-motion: no-preference)"
      },
      (context) => {
        const reveal = rootRef.current?.querySelectorAll("[data-launch-reveal]") ?? [];
        if (context.conditions?.reduceMotion) {
          gsap.set(reveal, { clearProps: "all" });
          return;
        }
        gsap.fromTo(reveal, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.48, stagger: 0.055, ease: "power2.out" });
        if (stage === "recovery") {
          const transferPacket = rootRef.current?.querySelector("[data-transfer-packet]");
          if (!transferPacket) return;
          gsap.fromTo(
            transferPacket,
            { xPercent: -150, opacity: 0 },
            { xPercent: 0, opacity: 1, duration: 0.9, ease: "power3.out" }
          );
        }
      }
    );
    return () => media.revert();
  }, [stage]);

  function update<K extends keyof ProductionLaunchDraft>(field: K, value: ProductionLaunchDraft[K]): void {
    setDraft((current) => ({ ...current, [field]: value }));
    setError(null);
  }

  function advanceCustodian(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setShowErrors(true);
    if (errors.ownerName || errors.ownerEmail || errors.workspaceSlug) return;
    setShowErrors(false);
    setStage("plan");
  }

  async function commitLaunch(): Promise<void> {
    setShowErrors(true);
    if (Object.keys(errors).length > 0) return;
    setBusy(true);
    setError(null);
    try {
      idempotencyKey.current ??= crypto.randomUUID();
      const created = await launchWorkspace(sandboxCredential, idempotencyKey.current, draft);
      setResult(created);
      setStage("recovery");
      setShowErrors(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The durable workspace could not be launched.");
    } finally {
      setBusy(false);
    }
  }

  async function copyKey(target: Exclude<CopyTarget, null>, value: string): Promise<void> {
    await navigator.clipboard.writeText(value);
    setCopied(target);
    setCustody((current) => ({ ...current, [target]: true }));
    window.setTimeout(() => setCopied(null), 1_600);
  }

  function downloadRecovery(): void {
    if (!result) return;
    const blob = new Blob([createProductionRecoveryBundle(result)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `capyn-${result.workspace.slug}-recovery.json`;
    anchor.click();
    URL.revokeObjectURL(href);
    setCustody((current) => ({ ...current, bundle: true }));
  }

  function rememberOwnerSession(): void {
    if (!result) return;
    window.sessionStorage.setItem(OWNER_SESSION_STORAGE_KEY, result.credentials.owner.apiKey);
  }

  function openControlPlane(): void {
    if (!result || !custodyComplete) return;
    rememberOwnerSession();
    window.location.assign(result.handoff.dashboardPath);
  }

  function openCheckout(): void {
    if (!result?.billing.checkoutUrl || !custodyComplete) return;
    rememberOwnerSession();
    window.location.assign(result.billing.checkoutUrl);
  }

  return (
    <main className="launch-shell" ref={rootRef}>
      <section className="launch-hero">
        <div className="launch-hero__field" aria-hidden="true" />
        <div className="site-container launch-hero__inner">
          <button type="button" className="launch-back" onClick={onBack}><ArrowLeft size={13} /> Return to sandbox proof</button>
          <div className="launch-hero__grid">
            <div data-launch-reveal>
              <p className="launch-kicker"><span /> DURABLE HANDOFF / HOSTED ALPHA</p>
              <h1 className="display-title">Cross the air gap.<br /><em>Keep the boundary.</em></h1>
              <p className="launch-hero__copy">Carry the identity and mandate you just proved into a tenant-scoped workspace with durable audit history, separate credentials and a real billing account.</p>
            </div>
            <div className="launch-transfer" data-launch-reveal aria-label="Sandbox to durable workspace transfer">
              <div><span>EPHEMERAL</span><strong>{activation.workspace.name}</strong><code>{activation.credential.keyPrefix}…</code></div>
              <div className="launch-transfer__rail"><i /><span data-transfer-packet>BOUNDARY</span><i /></div>
              <div><span>DESTINATION</span><strong>{result?.workspace.slug ?? (draft.workspaceSlug || "workspace-pending")}</strong><code>{result ? `${result.workspace.persistence} / COMMITTED` : "NOT YET WRITTEN"}</code></div>
            </div>
          </div>
        </div>
      </section>

      <section className="launch-bay">
        <div className="site-container">
          <div className="launch-console">
            <header className="launch-console__header">
              <p><Database size={13} /> CAPYN / PERSISTENCE GATE 01</p>
              <div><span>ONE-WAY CLAIM</span><span>HASHED CREDENTIALS</span><span>MOCK EXECUTION</span></div>
            </header>

            <div className="launch-console__body">
              <aside className="launch-rail" aria-label="Production launch progress">
                <ol>
                  {launchStages.map((item, index) => (
                    <li key={item.id} data-state={index < stageIndex ? "complete" : index === stageIndex ? "active" : "waiting"}>
                      <span>{index < stageIndex ? <Check size={12} /> : item.number}</span>
                      <p><strong>{item.label}</strong><small>{item.note}</small></p>
                    </li>
                  ))}
                </ol>
                <div className="launch-source-register">
                  <p>SOURCE BOUNDARY</p>
                  <dl>
                    <div><dt>Agent</dt><dd>{activation.agent.slug}</dd></div>
                    <div><dt>Mandate</dt><dd>{activation.mandate.name}</dd></div>
                    <div><dt>Capability</dt><dd>{activation.mandate.capabilities[0]}</dd></div>
                    <div><dt>Hard ceiling</dt><dd>${activation.mandate.limits.perTransaction}</dd></div>
                  </dl>
                </div>
              </aside>

              <section className="launch-workface">
                {stage === "custodian" && (
                  <form onSubmit={advanceCustodian} data-launch-reveal>
                    <LaunchHeading number="01" eyebrow="Accountable custodian" title="Who can change this boundary?" copy="The owner key controls agents, mandates, approvals and billing. Email identifies the account record; this alpha uses the one-time owner key—not email—as authentication." />
                    <div className="launch-form-grid">
                      <LaunchField label="Owner name" error={inputError(errors, "ownerName", showErrors)}>
                        <input value={draft.ownerName} onChange={(event) => update("ownerName", event.target.value)} placeholder="Taylor Morgan" />
                      </LaunchField>
                      <LaunchField label="Owner email" hint="Billing + account record" error={inputError(errors, "ownerEmail", showErrors)}>
                        <input type="email" value={draft.ownerEmail} onChange={(event) => update("ownerEmail", event.target.value)} placeholder="taylor@northstar.example" />
                      </LaunchField>
                    </div>
                    <LaunchField label="Workspace slug" hint="Permanent tenant address" error={inputError(errors, "workspaceSlug", showErrors)}>
                      <div className="launch-slug-field"><span>capyn /</span><input value={draft.workspaceSlug} onChange={(event) => { setSlugEdited(true); update("workspaceSlug", slugifyProductionWorkspace(event.target.value)); }} onBlur={() => { if (!slugEdited) update("workspaceSlug", slugifyProductionWorkspace(activation.workspace.name)); }} /></div>
                    </LaunchField>
                    <div className="launch-fact-strip">
                      <div><Fingerprint size={14} /><p><strong>Key-authenticated owner</strong><span>No password is created or transmitted.</span></p></div>
                      <div><Database size={14} /><p><strong>Tenant-scoped records</strong><span>Organisation ID is resolved server-side.</span></p></div>
                    </div>
                    <LaunchActions primary="Choose service rail" onPrimary={undefined} submit />
                  </form>
                )}

                {stage === "plan" && (
                  <div data-launch-reveal>
                    <LaunchHeading number="02" eyebrow="Commercial boundary" title="Pay for the control plane—not permission." copy="Every rail uses the same fail-closed policy engine. A paid plan changes hosted capacity, retention and operations; it never turns DENY into ALLOW." />
                    <div className="launch-plan-ledger" role="radiogroup" aria-label="Hosted plan intent">
                      {plans.map((plan) => (
                        <button key={plan.id} type="button" role="radio" aria-checked={draft.planIntent === plan.id} onClick={() => update("planIntent", plan.id)}>
                          <span className="launch-plan-ledger__signal">{plan.signal}</span>
                          <span><strong>{plan.name}</strong><small>{plan.audience}</small></span>
                          <span><strong>{plan.price}</strong><small>{plan.id === "DEVELOPER" ? "no card" : "USD / month"}</small></span>
                          <span>{plan.features.slice(0, 3).map((feature) => <small key={feature}><Check size={10} />{feature}</small>)}</span>
                          <i>{draft.planIntent === plan.id ? <CheckCircle2 size={17} /> : null}</i>
                        </button>
                      ))}
                    </div>
                    <p className="launch-plan-note"><TriangleAlert size={13} /><span><strong>Hosted alpha boundary:</strong> policy, persistence, credentials, approvals and evidence are real. Execution remains mock on every self-serve rail until an adapter is explicitly contracted.</span></p>
                    <LaunchActions secondary="Custodian" primary="Review durable commit" onSecondary={() => setStage("custodian")} onPrimary={() => setStage("commit")} />
                  </div>
                )}

                {stage === "commit" && (
                  <div data-launch-reveal>
                    <LaunchHeading number="03" eyebrow="Durable write" title="This is where the sandbox becomes an account." copy="One transaction writes the organisation, owner, agent, mandate, subscription and both credential digests. The sandbox claim cannot create a second workspace." />
                    <div className="launch-commit-ledger">
                      <header><span>COMMIT MANIFEST</span><code>6 RECORD SETS / 1 TRANSACTION</code></header>
                      <dl>
                        <div><dt>Workspace</dt><dd>{activation.workspace.name}<small>{draft.workspaceSlug}</small></dd><span>DURABLE</span></div>
                        <div><dt>Owner</dt><dd>{draft.ownerName}<small>{draft.ownerEmail}</small></dd><span>OWNER</span></div>
                        <div><dt>Agent</dt><dd>{activation.agent.name}<small>{activation.agent.slug}</small></dd><span>ACTIVE</span></div>
                        <div><dt>Mandate</dt><dd>{activation.mandate.name}<small>30-day active import</small></dd><span>V1</span></div>
                        <div><dt>Service rail</dt><dd>{PLAN_CATALOG[draft.planIntent].name}<small>Developer active until paid checkout is verified</small></dd><span>{draft.planIntent}</span></div>
                      </dl>
                    </div>
                    <div className="launch-acknowledgements">
                      <label><input type="checkbox" checked={draft.keyCustody} onChange={(event) => update("keyCustody", event.target.checked)} /><span><strong>I will secure both one-time keys.</strong><small>CAPYN stores only HMAC digests and cannot display these plaintext values later.</small></span></label>
                      {inputError(errors, "keyCustody", showErrors) && <em>{errors.keyCustody}</em>}
                      <label><input type="checkbox" checked={draft.syntheticExecution} onChange={(event) => update("syntheticExecution", event.target.checked)} /><span><strong>I understand execution remains synthetic.</strong><small>This creates durable authority infrastructure, not a live money-moving adapter or an implied SLA.</small></span></label>
                      {inputError(errors, "syntheticExecution", showErrors) && <em>{errors.syntheticExecution}</em>}
                    </div>
                    {error && <LaunchError message={error} />}
                    <LaunchActions secondary="Service rail" primary={busy ? "Writing durable ledger…" : "Commit workspace"} onSecondary={() => setStage("plan")} onPrimary={() => void commitLaunch()} busy={busy} />
                  </div>
                )}

                {stage === "recovery" && result && (
                  <div data-launch-reveal>
                    <LaunchHeading number="04" eyebrow="Custody handoff" title="The air gap is crossed." copy="Your boundary now has durable identity and evidence. Take custody of both plaintext keys before leaving; they will never be returned by a normal read endpoint." />
                    <div className="launch-success-stamp"><CheckCircle2 size={23} /><p><strong>WORKSPACE COMMITTED</strong><span>{result.workspace.id} · {new Date(result.createdAt).toISOString()}</span></p><code>{result.replayed ? "IDEMPOTENT REPLAY" : "FIRST WRITE"}</code></div>
                    <div className="launch-key-locker">
                      <header><span>ONE-TIME KEY LOCKER</span><code>PLAINTEXT / CLIENT CUSTODY</code></header>
                      <KeyLockerRow label="Owner access" scope="CONTROL PLANE" value={result.credentials.owner.apiKey} visible={ownerVisible} copied={copied === "owner"} onReveal={() => setOwnerVisible((value) => !value)} onCopy={() => void copyKey("owner", result.credentials.owner.apiKey)} />
                      <KeyLockerRow label="Agent credential" scope="AUTHORIZE API" value={result.credentials.agent.apiKey} visible={agentVisible} copied={copied === "agent"} onReveal={() => setAgentVisible((value) => !value)} onCopy={() => void copyKey("agent", result.credentials.agent.apiKey)} />
                    </div>
                    <div className="launch-recovery-actions">
                      <button type="button" onClick={downloadRecovery}><Download size={14} />{custody.bundle ? "Recovery bundle downloaded" : "Download recovery bundle"}</button>
                      <p><LockKeyhole size={13} /><span>The JSON contains both plaintext keys. Put it in a secret manager, then remove the download from this device.</span></p>
                    </div>
                    <div className="launch-billing-handoff">
                      <div><CreditCard size={17} /><p><strong>{result.billing.planIntent === "DEVELOPER" ? "Developer is active" : `${PLAN_CATALOG[result.billing.planIntent].name} intent recorded`}</strong><span>{result.billing.note}</span></p></div>
                      <span>{result.billing.checkoutAvailable ? "CHECKOUT READY" : result.billing.planIntent === "DEVELOPER" ? "$0 ACTIVE" : "CHECKOUT PENDING"}</span>
                    </div>
                    {!custodyComplete && <p className="launch-custody-gate"><TriangleAlert size={13} /> Download the bundle, or copy both keys, before opening the control plane.</p>}
                    <div className="launch-final-actions">
                      {result.billing.checkoutUrl && <button type="button" className="is-checkout" disabled={!custodyComplete} onClick={openCheckout}><CreditCard size={14} /> Continue to verified checkout</button>}
                      <button type="button" className="is-control" disabled={!custodyComplete} onClick={openControlPlane}><UserRoundCheck size={14} /> Open your control plane <ArrowRight size={14} /></button>
                    </div>
                  </div>
                )}
              </section>

              <aside className="launch-destination" aria-label="Durable destination register">
                <header><span>DURABLE REGISTER</span><code>{result ? "COMMITTED" : "PENDING"}</code></header>
                <dl>
                  <RegisterRow label="Source" value="STATELESS_SANDBOX" state={result ? "consumed" : "verified"} />
                  <RegisterRow label="Workspace" value={result?.workspace.id ?? draft.workspaceSlug} state={result ? "written" : "planned"} />
                  <RegisterRow label="Owner" value={result?.owner.email ?? (draft.ownerEmail || "not bound")} state={result ? "keyed" : "pending"} />
                  <RegisterRow label="Agent" value={result?.agent.id ?? activation.agent.slug} state={result ? "active" : "import"} />
                  <RegisterRow label="Mandate" value={result?.mandate.id ?? activation.mandate.name} state={result ? "v1 active" : "import"} />
                  <RegisterRow label="Billing" value={result?.billing.activePlan ?? PLAN_CATALOG[draft.planIntent].name} state={result ? "accounted" : "intent"} />
                </dl>
                <div className="launch-destination__boundary"><ShieldCheck size={15} /><p><strong>Authority preserved</strong><span>The imported limits are not widened during launch. Paid capacity never changes a policy decision.</span></p></div>
              </aside>
            </div>
          </div>
          <p className="launch-disclosure"><LockKeyhole size={12} /> Hosted alpha: {persistenceCopy(result?.workspace.persistence)}, hashed credentials and tenant-scoped audit history. Execution remains synthetic; no funds move.</p>
        </div>
      </section>
    </main>
  );
}

function LaunchHeading({ number, eyebrow, title, copy }: { number: string; eyebrow: string; title: string; copy: string }) {
  return <header className="launch-heading"><div><span>{number}</span><p>{eyebrow}</p></div><h2 className="display-title">{title}</h2><p>{copy}</p></header>;
}

function LaunchField({ label, hint, error, children }: { label: string; hint?: string | undefined; error?: string | undefined; children: ReactNode }) {
  return <label className="launch-field"><span>{label}{hint && <small>{hint}</small>}</span>{children}{error && <em><TriangleAlert size={11} />{error}</em>}</label>;
}

function LaunchActions({ secondary, primary, onSecondary, onPrimary, submit = false, busy = false }: { secondary?: string; primary: string; onSecondary?: () => void; onPrimary?: (() => void) | undefined; submit?: boolean; busy?: boolean }) {
  return <div className="launch-actions">{secondary ? <button type="button" className="is-back" onClick={onSecondary}><ArrowLeft size={13} />{secondary}</button> : <span />}<button type={submit ? "submit" : "button"} className="is-forward" onClick={submit ? undefined : onPrimary} disabled={busy}>{busy ? <LoaderCircle className="commission-spinner" size={14} /> : <ArrowRight size={14} />}{primary}</button></div>;
}

function LaunchError({ message }: { message: string }) {
  return <div className="launch-error" role="alert"><TriangleAlert size={15} /><p><strong>Durable commit stopped</strong><span>{message}</span></p></div>;
}

function KeyLockerRow({ label, scope, value, visible, copied, onReveal, onCopy }: { label: string; scope: string; value: string; visible: boolean; copied: boolean; onReveal: () => void; onCopy: () => void }) {
  return <div className="launch-key-row"><div><span>{label}</span><code>{scope}</code></div><strong>{visible ? value : maskProductionCredential(value)}</strong><div><button type="button" onClick={onReveal}>{visible ? <EyeOff size={13} /> : <Eye size={13} />}{visible ? "Hide" : "Reveal"}</button><button type="button" onClick={onCopy}><Clipboard size={13} />{copied ? "Copied" : "Copy"}</button></div></div>;
}

function RegisterRow({ label, value, state }: { label: string; value: string; state: string }) {
  return <div><dt>{label}<span>{state}</span></dt><dd title={value}>{value}</dd></div>;
}
