"use client";

import Link from "next/link";
import { gsap } from "gsap";
import {
  ArrowLeft,
  ArrowRight,
  Braces,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clipboard,
  Download,
  FileCheck2,
  Fingerprint,
  Gauge,
  KeyRound,
  Link2,
  LockKeyhole,
  Plus,
  RotateCcw,
  Save,
  ScanLine,
  ShieldCheck,
  Trash2,
  X
} from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent
} from "react";
import {
  MANDATE_STUDIO_STORAGE_KEY,
  createMandateConfig,
  createMandateStudioDraft,
  createStudioDecisionSamples,
  createStudioLabHref,
  createStudioTypeScript,
  createStudioVendor,
  getMandateStudioStatus,
  isStudioStageValid,
  parseStoredMandateDraft,
  serializeStoredMandateDraft,
  studioCapabilities,
  studioPresets,
  studioStages,
  validateMandateStudioDraft,
  type MandateStudioDraft,
  type StudioCapability,
  type StudioLimits,
  type StudioPresetId,
  type StudioStage,
  type StudioValidityDays
} from "@/lib/mandate-studio";
import { parseLabHandoff } from "@/lib/demo-authority";
import {
  createAuthorityPassportEnvelope,
  createAuthorityPassportHref,
  type AuthorityPassportEnvelope
} from "@/lib/authority-passport";

type CopyTarget = "json" | "typescript" | "passport" | null;
type CodeView = "json" | "typescript";

const stageDescriptions: Record<StudioStage, string> = {
  action: "Name one exact consequential action and the agent asking to take it.",
  boundary: "Grant only the capabilities and counterparties this action needs.",
  limits: "Place the hard stop first, then put human judgment below it.",
  integrate: "Carry the draft into code, rehearse the request and preserve the configuration."
};

function formatSavedTime(value: string | null): string {
  if (!value) return "Waiting for first save";
  return `Saved ${new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function money(value: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "$—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(amount);
}

export function MandateStudio() {
  const [draft, setDraft] = useState<MandateStudioDraft>(() => createMandateStudioDraft());
  const [stage, setStage] = useState<StudioStage>("action");
  const [hydrated, setHydrated] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [resumeNotice, setResumeNotice] = useState<string | null>(null);
  const [vendorInput, setVendorInput] = useState("");
  const [vendorIssue, setVendorIssue] = useState<string | null>(null);
  const [copyTarget, setCopyTarget] = useState<CopyTarget>(null);
  const [codeView, setCodeView] = useState<CodeView>("json");
  const rootRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const stampRef = useRef<HTMLDivElement>(null);
  const seamRef = useRef<HTMLSpanElement>(null);
  const didInitializeRef = useRef(false);

  const errors = useMemo(() => validateMandateStudioDraft(draft), [draft]);
  const passport = useMemo(() => getMandateStudioStatus(draft), [draft]);
  const config = useMemo(() => createMandateConfig(draft), [draft]);
  const configJson = useMemo(() => JSON.stringify(config, null, 2), [config]);
  const typescript = useMemo(() => createStudioTypeScript(draft), [draft]);
  const decisionSamples = useMemo(() => createStudioDecisionSamples(draft), [draft]);
  const labHref = useMemo(() => createStudioLabHref(draft), [draft]);
  const stageIndex = studioStages.findIndex((item) => item.id === stage);
  const stageMeta = studioStages[stageIndex] ?? studioStages[0];
  const currentStageValid = isStudioStageValid(draft, stage);

  useEffect(() => {
    if (didInitializeRef.current) return;
    didInitializeRef.current = true;

    const handoff = parseLabHandoff(window.location.search);
    if (handoff && window.location.search) {
      const base = createMandateStudioDraft();
      const capabilityLabel = studioCapabilities.find((item) => item.id === handoff.request.capability)?.label ?? "Agent action";
      const vendorName = handoff.request.vendor.name ?? handoff.request.vendor.id;
      const importedVendor = createStudioVendor(vendorName) ?? { id: handoff.request.vendor.id, name: vendorName };
      setDraft({
        ...base,
        mandateName: `${capabilityLabel} authority`,
        purpose: handoff.request.purpose,
        capabilities: [handoff.request.capability as StudioCapability],
        vendors: [importedVendor]
      });
      setResumeNotice(`Request imported from the ${handoff.source === "homepage" ? "homepage builder" : "shared setup"}. Policy limits still need your review.`);
      window.history.replaceState({}, "", "/start");
      setHydrated(true);
      return;
    }
    const storedValue = window.localStorage.getItem(MANDATE_STUDIO_STORAGE_KEY);
    if (storedValue) {
      const stored = parseStoredMandateDraft(storedValue);
      if (stored) {
        setDraft(stored.draft);
        setSavedAt(stored.savedAt);
        setResumeNotice(`Draft restored from ${new Date(stored.savedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}.`);
      } else {
        window.localStorage.removeItem(MANDATE_STUDIO_STORAGE_KEY);
        setResumeNotice("An unreadable saved draft was discarded. A clean boundary is ready.");
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timestamp = new Date().toISOString();
    window.localStorage.setItem(MANDATE_STUDIO_STORAGE_KEY, serializeStoredMandateDraft(draft, timestamp));
    setSavedAt(timestamp);
  }, [draft, hydrated]);

  useLayoutEffect(() => {
    if (!rootRef.current) return;
    const media = gsap.matchMedia();
    media.add(
      {
        reduceMotion: "(prefers-reduced-motion: reduce)",
        motionAllowed: "(prefers-reduced-motion: no-preference)"
      },
      (context) => {
        const targets = "[data-studio-reveal]";
        if (context.conditions?.reduceMotion) {
          gsap.set(targets, { clearProps: "all" });
          return;
        }
        gsap.timeline({ defaults: { ease: "power3.out" } })
          .fromTo("[data-studio-kicker]", { autoAlpha: 0, y: 8 }, { autoAlpha: 1, duration: 0.35, y: 0 })
          .fromTo(targets, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, duration: 0.56, stagger: 0.08, y: 0 }, 0.08);
      },
      rootRef
    );
    return () => media.revert();
  }, []);

  useLayoutEffect(() => {
    if (!rootRef.current || !panelRef.current || !stampRef.current || !seamRef.current) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(panelRef.current, { autoAlpha: 0.35, x: 12 }, { autoAlpha: 1, duration: 0.34, ease: "power2.out", x: 0 });
      gsap.fromTo(stampRef.current, { rotate: -5, scale: 0.94 }, { duration: 0.42, ease: "back.out(1.8)", rotate: -1, scale: 1 });
      gsap.to(seamRef.current, { duration: 0.48, ease: "power2.out", scaleX: (stageIndex + 1) / studioStages.length });
    });
    return () => media.revert();
  }, [passport.status, stageIndex]);

  function updateDraft(update: (current: MandateStudioDraft) => MandateStudioDraft): void {
    setDraft(update);
    setResumeNotice(null);
  }

  function applyPreset(id: StudioPresetId): void {
    setDraft(createMandateStudioDraft(id));
    setStage("action");
    setVendorInput("");
    setVendorIssue(null);
    setResumeNotice(`${studioPresets.find((preset) => preset.id === id)?.label ?? "Boundary"} preset loaded.`);
  }

  function focusFirstError(targetStage: StudioStage): void {
    const orderedFields: Record<StudioStage, string[]> = {
      action: ["agentName", "mandateName", "purpose"],
      boundary: ["capabilities", "vendors"],
      limits: ["approvalAbove", "perTransaction", "daily", "monthly", "validityDays"],
      integrate: []
    };
    const firstField = orderedFields[targetStage].find((field) => errors[field as keyof typeof errors]);
    if (!firstField) return;
    window.requestAnimationFrame(() => {
      const element = rootRef.current?.querySelector<HTMLElement>(`[data-studio-field="${firstField}"]`);
      element?.focus();
    });
  }

  function selectStage(nextIndex: number): void {
    const boundedIndex = Math.max(0, Math.min(studioStages.length - 1, nextIndex));
    for (let index = 0; index < boundedIndex; index += 1) {
      const prerequisite = studioStages[index]?.id;
      if (!prerequisite) continue;
      if (!isStudioStageValid(draft, prerequisite)) {
        setStage(prerequisite);
        focusFirstError(prerequisite);
        return;
      }
    }
    setStage(studioStages[boundedIndex]?.id ?? "action");
  }

  function handleStageKey(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    let target: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") target = (index + 1) % studioStages.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") target = (index - 1 + studioStages.length) % studioStages.length;
    if (event.key === "Home") target = 0;
    if (event.key === "End") target = studioStages.length - 1;
    if (target === null) return;
    event.preventDefault();
    selectStage(target);
    const targetStage = studioStages[target]?.id ?? "action";
    window.requestAnimationFrame(() => rootRef.current?.querySelector<HTMLButtonElement>(`#studio-stage-${targetStage}`)?.focus());
  }

  function addVendor(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const vendor = createStudioVendor(vendorInput);
    if (!vendor) {
      setVendorIssue("Enter a vendor name using letters or numbers.");
      return;
    }
    if (draft.vendors.some((item) => item.id === vendor.id)) {
      setVendorIssue(`${vendor.name} is already approved.`);
      return;
    }
    if (draft.vendors.length >= 10) {
      setVendorIssue("This public draft supports up to ten vendors.");
      return;
    }
    updateDraft((current) => ({ ...current, vendors: [...current.vendors, vendor] }));
    setVendorInput("");
    setVendorIssue(null);
  }

  async function copyCode(target: Exclude<CopyTarget, null>, value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopyTarget(target);
      window.setTimeout(() => setCopyTarget(null), 1_800);
    } catch {
      setCopyTarget(null);
    }
  }

  function downloadConfig(): void {
    const blob = new Blob([configJson], { type: "application/json" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `${draft.agentName || "capyn-agent"}-mandate.json`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  }

  async function issuePassport(): Promise<AuthorityPassportEnvelope | null> {
    if (passport.status !== "TESTABLE") {
      setResumeNotice("Complete the identity, scope and limits before issuing an Authority Passport.");
      return null;
    }
    try {
      return await createAuthorityPassportEnvelope(draft);
    } catch {
      setResumeNotice("The passport could not be issued from this draft. Review the boundary and try again.");
      return null;
    }
  }

  async function openPassport(): Promise<void> {
    const envelope = await issuePassport();
    if (envelope) window.location.assign(createAuthorityPassportHref(envelope));
  }

  async function copyPassportLink(): Promise<void> {
    const envelope = await issuePassport();
    if (!envelope) return;
    const url = new URL(createAuthorityPassportHref(envelope), window.location.origin).toString();
    await copyCode("passport", url);
  }

  async function downloadPassport(): Promise<void> {
    const envelope = await issuePassport();
    if (!envelope) return;
    const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: "application/json" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `${draft.agentName || "capyn-agent"}-authority-passport.json`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
    setResumeNotice("Verifiable Authority Passport downloaded. It remains a draft artifact, not active policy.");
  }

  function resetDraft(): void {
    const fresh = createMandateStudioDraft();
    window.localStorage.removeItem(MANDATE_STUDIO_STORAGE_KEY);
    setDraft(fresh);
    setStage("action");
    setVendorInput("");
    setVendorIssue(null);
    setResumeNotice("Draft reset to the inference boundary preset.");
  }

  return (
    <main ref={rootRef} className="studio-page">
      <section className="studio-hero">
        <div className="studio-hero__field" aria-hidden="true" />
        <div className="site-container studio-hero__shell">
          <div className="studio-hero__meta" data-studio-kicker>
            <p><span /> MANDATE STUDIO / BROWSER-LOCAL DRAFT</p>
            <p>NO ACCOUNT · NO SECRETS · NO EXECUTION</p>
          </div>
          <div className="studio-hero__grid">
            <div data-studio-reveal>
              <h1 className="display-title">Turn one consequence into <em>bounded authority.</em></h1>
            </div>
            <div className="studio-hero__brief" data-studio-reveal>
              <p>Name the action. Draw the hard stop. Place the human line. Leave with a testable mandate and integration code.</p>
              <div>
                <span><Fingerprint size={14} /> Identity-bound</span>
                <span><LockKeyhole size={14} /> Fail-closed</span>
                <span><FileCheck2 size={14} /> Exportable</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="studio-workspace" aria-labelledby="studio-workspace-title">
        <div className="site-container">
          <div className="studio-local-notice" data-studio-reveal>
            <div>
              <Save size={14} />
              <p><strong>Your draft stays in this browser.</strong><span>CAPYN does not receive this configuration, create an account or activate authority from this page.</span></p>
            </div>
            <span aria-live="polite">{formatSavedTime(savedAt)}</span>
          </div>

          {resumeNotice && (
            <div className="studio-resume" role="status">
              <CheckCircle2 size={14} /><span>{resumeNotice}</span><button type="button" onClick={() => setResumeNotice(null)} aria-label="Dismiss saved-draft notice"><X size={13} /></button>
            </div>
          )}

          <div className="studio-progress" role="tablist" aria-label="Mandate creation stages" data-studio-reveal>
            {studioStages.map((item, index) => {
              const selected = item.id === stage;
              const complete = isStudioStageValid(draft, item.id) && (index < stageIndex || item.id === "integrate");
              return (
                <button
                  key={item.id}
                  id={`studio-stage-${item.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls="studio-stage-panel"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => selectStage(index)}
                  onKeyDown={(event) => handleStageKey(event, index)}
                >
                  <span>{complete ? <Check size={12} /> : String(index + 1).padStart(2, "0")}</span>
                  <p><strong>{item.short}</strong><small>{item.label}</small></p>
                  {index < studioStages.length - 1 && <i aria-hidden="true" />}
                </button>
              );
            })}
          </div>

          <div className="studio-workspace__grid">
            <div className="studio-editor" data-studio-reveal>
              <header className="studio-editor__head">
                <div>
                  <p>{String(stageIndex + 1).padStart(2, "0")} / {stageMeta.short}</p>
                  <h2 id="studio-workspace-title" className="display-title">{stageMeta.label}</h2>
                  <span>{stageDescriptions[stage]}</span>
                </div>
                <div><span>{currentStageValid ? "READY" : "NEEDS INPUT"}</span><i className={currentStageValid ? "is-ready" : ""} /></div>
              </header>

              <div ref={panelRef} id="studio-stage-panel" role="tabpanel" aria-labelledby={`studio-stage-${stage}`} className="studio-editor__panel">
                {stage === "action" && (
                  <div className="studio-stage studio-stage--action">
                    <fieldset className="studio-presets">
                      <legend>Start from a real authority pattern</legend>
                      <div>
                        {studioPresets.map((preset) => (
                          <button key={preset.id} type="button" aria-pressed={draft.presetId === preset.id} onClick={() => applyPreset(preset.id)}>
                            <span>{preset.label}</span><small>{preset.note}</small><ChevronRight size={14} />
                          </button>
                        ))}
                      </div>
                    </fieldset>

                    <div className="studio-field-grid">
                      <StudioField label="Requesting agent" error={errors.agentName} hint="Lowercase slug; identity comes from the API key in production.">
                        <div className="studio-input-shell"><Fingerprint size={15} /><input data-studio-field="agentName" value={draft.agentName} onChange={(event) => updateDraft((current) => ({ ...current, agentName: event.target.value }))} aria-invalid={Boolean(errors.agentName)} /></div>
                      </StudioField>
                      <StudioField label="Mandate name" error={errors.mandateName}>
                        <div className="studio-input-shell"><ShieldCheck size={15} /><input data-studio-field="mandateName" value={draft.mandateName} onChange={(event) => updateDraft((current) => ({ ...current, mandateName: event.target.value }))} aria-invalid={Boolean(errors.mandateName)} /></div>
                      </StudioField>
                    </div>
                    <StudioField label="Exact consequential action" error={errors.purpose} hint={`${draft.purpose.length}/160 · Describe the action, not a broad AI project.`}>
                      <textarea data-studio-field="purpose" value={draft.purpose} maxLength={160} onChange={(event) => updateDraft((current) => ({ ...current, purpose: event.target.value }))} aria-invalid={Boolean(errors.purpose)} />
                    </StudioField>
                  </div>
                )}

                {stage === "boundary" && (
                  <div className="studio-stage studio-stage--boundary">
                    <fieldset className="studio-capabilities">
                      <legend>Granted capabilities <span>Everything else fails closed.</span></legend>
                      <div data-studio-field="capabilities" tabIndex={-1}>
                        {studioCapabilities.map((capability) => {
                          const checked = draft.capabilities.includes(capability.id);
                          return (
                            <label key={capability.id} className={checked ? "is-selected" : ""}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) => updateDraft((current) => ({
                                  ...current,
                                  capabilities: event.target.checked
                                    ? [...current.capabilities, capability.id]
                                    : current.capabilities.filter((item) => item !== capability.id)
                                }))}
                              />
                              <span>{checked ? <Check size={13} /> : null}</span>
                              <p><strong>{capability.label}</strong><code>{capability.id}</code><small>{capability.note}</small></p>
                              {capability.sensitive && <em>SENSITIVE</em>}
                            </label>
                          );
                        })}
                      </div>
                      {errors.capabilities && <p className="studio-field-error"><CircleAlert size={12} />{errors.capabilities}</p>}
                    </fieldset>

                    <fieldset className="studio-vendors">
                      <legend>Approved vendors <span>Unknown counterparties are denied before spend checks.</span></legend>
                      <div className="studio-vendor-list" data-studio-field="vendors" tabIndex={-1}>
                        {draft.vendors.map((vendor) => (
                          <span key={vendor.id}><Check size={12} /><strong>{vendor.name}</strong><code>{vendor.id}</code><button type="button" onClick={() => updateDraft((current) => ({ ...current, vendors: current.vendors.filter((item) => item.id !== vendor.id) }))} aria-label={`Remove ${vendor.name}`}><X size={12} /></button></span>
                        ))}
                      </div>
                      <form onSubmit={addVendor} className="studio-vendor-add">
                        <div className="studio-input-shell"><Plus size={14} /><input value={vendorInput} onChange={(event) => { setVendorInput(event.target.value); setVendorIssue(null); }} placeholder="Add an approved vendor" aria-label="Approved vendor name" /></div>
                        <button type="submit">Add vendor</button>
                      </form>
                      {(vendorIssue || errors.vendors) && <p className="studio-field-error"><CircleAlert size={12} />{vendorIssue ?? errors.vendors}</p>}
                    </fieldset>
                  </div>
                )}

                {stage === "limits" && (
                  <div className="studio-stage studio-stage--limits">
                    <div className="studio-limit-order">
                      <span>ALLOW</span><i /><span>HUMAN</span><i /><span>HARD STOP</span>
                    </div>
                    <div className="studio-money-grid">
                      <StudioMoneyField field="approvalAbove" label="Human approval above" value={draft.limits.approvalAbove} error={errors.approvalAbove} onChange={(value) => updateDraft((current) => ({ ...current, limits: { ...current.limits, approvalAbove: value } }))} />
                      <StudioMoneyField field="perTransaction" label="Hard per action" value={draft.limits.perTransaction} error={errors.perTransaction} onChange={(value) => updateDraft((current) => ({ ...current, limits: { ...current.limits, perTransaction: value } }))} />
                      <StudioMoneyField field="daily" label="Per UTC day" value={draft.limits.daily} error={errors.daily} onChange={(value) => updateDraft((current) => ({ ...current, limits: { ...current.limits, daily: value } }))} />
                      <StudioMoneyField field="monthly" label="Per calendar month" value={draft.limits.monthly} error={errors.monthly} onChange={(value) => updateDraft((current) => ({ ...current, limits: { ...current.limits, monthly: value } }))} />
                    </div>
                    <fieldset className="studio-validity">
                      <legend>Validity window <span>Expired authority is denied without human override.</span></legend>
                      <div data-studio-field="validityDays" tabIndex={-1}>
                        {([30, 90, 365] as StudioValidityDays[]).map((days) => (
                          <button type="button" key={days} aria-pressed={draft.validityDays === days} onClick={() => updateDraft((current) => ({ ...current, validityDays: days }))}><strong>{days}</strong><span>days</span></button>
                        ))}
                      </div>
                    </fieldset>
                    <div className="studio-limit-note"><LockKeyhole size={16} /><p><strong>Approval is not an escape hatch.</strong><span>A person can release one request above {money(draft.limits.approvalAbove)}. They cannot override the {money(draft.limits.perTransaction)} hard ceiling, an ungranted capability or an unknown vendor.</span></p></div>
                  </div>
                )}

                {stage === "integrate" && (
                  <div className="studio-stage studio-stage--integrate">
                    <div className="studio-outcomes" aria-label="Decision boundary preview">
                      {decisionSamples.map((sample) => (
                        <article key={sample.decision} className={`studio-outcome studio-outcome--${sample.tone}`}>
                          <span>{sample.decision === "REQUIRE_APPROVAL" ? "HUMAN" : sample.decision}</span><strong>${sample.amount}</strong><p>{sample.reason}</p>
                        </article>
                      ))}
                    </div>

                    <div className="studio-code">
                      <div className="studio-code__bar">
                        <div role="tablist" aria-label="Generated mandate artifacts">
                          <button type="button" role="tab" aria-selected={codeView === "json"} onClick={() => setCodeView("json")}><Braces size={12} /> Mandate JSON</button>
                          <button type="button" role="tab" aria-selected={codeView === "typescript"} onClick={() => setCodeView("typescript")}><KeyRound size={12} /> TypeScript</button>
                        </div>
                        <button type="button" onClick={() => void copyCode(codeView, codeView === "json" ? configJson : typescript)}><Clipboard size={12} /> {copyTarget === codeView ? "Copied" : "Copy"}</button>
                      </div>
                      <pre><code>{codeView === "json" ? configJson : typescript}</code></pre>
                    </div>

                    <div className="studio-passport-issue">
                      <div><ScanLine size={16} /><p><strong>Issue a Verifiable Authority Passport.</strong><span>Package this complete draft with a canonical SHA-256 digest. The share link stays client-side and does not activate authority.</span></p></div>
                      <div>
                        <button type="button" className="is-primary" onClick={() => void openPassport()}><ShieldCheck size={14} /> Open passport</button>
                        <button type="button" onClick={() => void copyPassportLink()}><Link2 size={14} /> {copyTarget === "passport" ? "Link copied" : "Copy share link"}</button>
                        <button type="button" onClick={() => void downloadPassport()}><Download size={14} /> Download passport</button>
                      </div>
                    </div>

                    <div className="studio-ship-actions">
                      <button type="button" onClick={downloadConfig}><Download size={14} /> Download draft JSON</button>
                      {labHref ? <Link href={labHref}><Link2 size={14} /> Rehearse request in the Lab</Link> : <span><CircleAlert size={14} /> Add OpenAI, Anthropic, AWS or GitHub to rehearse in the public Lab.</span>}
                    </div>
                    <p className="studio-lab-disclosure">The public Lab evaluates the imported request against its fixed synthetic mandate. It does not activate this browser-local draft.</p>

                    <ol className="studio-checklist">
                      <li><span><Check size={12} /></span><p><strong>Store the API key in your secret manager.</strong><small>Never paste a credential into this browser draft or source control.</small></p></li>
                      <li><span>2</span><p><strong>Create the agent and mandate in a hosted workspace.</strong><small>The exported JSON is a design artifact, not activated policy.</small></p></li>
                      <li><span>3</span><p><strong>Call authorize before consequence.</strong><small>Branch on ALLOW, DENY or REQUIRE_APPROVAL and retain the evidence receipt.</small></p></li>
                    </ol>
                  </div>
                )}
              </div>

              <footer className="studio-editor__foot">
                <button type="button" onClick={() => selectStage(stageIndex - 1)} disabled={stageIndex === 0}><ArrowLeft size={14} /> Previous</button>
                <p><span>{stageMeta.short}</span>{currentStageValid ? "Boundary is valid." : "Resolve the highlighted fields to continue."}</p>
                {stageIndex < studioStages.length - 1 ? (
                  <button type="button" className="is-primary" onClick={() => selectStage(stageIndex + 1)}>Continue <ArrowRight size={14} /></button>
                ) : (
                  <Link href="/design-partners" className="is-primary">Request a hosted workspace <ArrowRight size={14} /></Link>
                )}
              </footer>
            </div>

            <aside className="studio-passport" aria-label="Live mandate passport" data-studio-reveal>
              <div className="studio-passport__perforation" aria-hidden="true" />
              <header>
                <div><span>CAPYN / MANDATE PASSPORT</span><strong>M/01</strong></div>
                <div ref={stampRef} className={`studio-passport__stamp studio-passport__stamp--${passport.status.toLowerCase()}`}><span />{passport.status}</div>
              </header>
              <div className="studio-passport__identity">
                <Fingerprint size={18} />
                <p><span>Requesting identity</span><strong>{draft.agentName || "unbound-agent"}</strong></p>
                <LockKeyhole size={14} />
              </div>
              <div className="studio-passport__rail">
                <span ref={seamRef} aria-hidden="true" />
                {["Identity", "Scope", "Limits", "Evidence"].map((label, index) => <i key={label} className={index <= stageIndex ? "is-active" : ""}><b>{String(index + 1).padStart(2, "0")}</b>{label}</i>)}
              </div>
              <section>
                <p>Exact action</p>
                <h2>{draft.mandateName || "Unnamed authority"}</h2>
                <span>{draft.purpose || "Name the consequential action this mandate will govern."}</span>
              </section>
              <dl>
                <div><dt>Capabilities</dt><dd>{draft.capabilities.length ? draft.capabilities.join(" · ") : "none granted"}</dd></div>
                <div><dt>Approved vendors</dt><dd>{draft.vendors.length ? draft.vendors.map((vendor) => vendor.name).join(" · ") : "none approved"}</dd></div>
                <div><dt>Human above</dt><dd>{money(draft.limits.approvalAbove)}</dd></div>
                <div><dt>Hard per action</dt><dd>{money(draft.limits.perTransaction)}</dd></div>
                <div><dt>Daily / monthly</dt><dd>{money(draft.limits.daily)} / {money(draft.limits.monthly)}</dd></div>
                <div><dt>Validity</dt><dd>{draft.validityDays} days</dd></div>
              </dl>
              <footer>
                <div><Gauge size={15} /><p><strong>{passport.completed}/{passport.total}</strong><span>boundary groups valid</span></p></div>
                <code>mandate_{draft.agentName || "unbound"}_v1</code>
              </footer>
            </aside>
          </div>

          <div className="studio-reset-row">
            <p><Trash2 size={13} /> Need a clean slate? Resetting removes the current browser-local draft and loads the safe inference preset.</p>
            <button type="button" onClick={resetDraft}><RotateCcw size={13} /> Reset draft</button>
          </div>
        </div>
      </section>

      <div className="studio-mobile-dock" aria-label="Mandate Studio stage actions">
        <button type="button" onClick={() => selectStage(stageIndex - 1)} disabled={stageIndex === 0} aria-label="Previous stage"><ArrowLeft size={16} /></button>
        <p><span>{String(stageIndex + 1)} / {studioStages.length}</span><strong>{stageMeta.short}</strong></p>
        {stageIndex < studioStages.length - 1 ? <button type="button" onClick={() => selectStage(stageIndex + 1)} aria-label="Continue to next stage"><ArrowRight size={16} /></button> : <Link href="/design-partners" aria-label="Request a hosted workspace"><ArrowRight size={16} /></Link>}
      </div>

      <span className="sr-only" role="status" aria-live="polite">
        {copyTarget === "json" ? "Mandate JSON copied" : copyTarget === "typescript" ? "TypeScript integration copied" : copyTarget === "passport" ? "Authority Passport link copied" : ""}
      </span>
    </main>
  );
}

function StudioField({ label, hint, error, children }: { label: string; hint?: string | undefined; error?: string | undefined; children: React.ReactNode }) {
  return (
    <label className="studio-field">
      <span>{label}</span>
      {children}
      {error ? <small className="studio-field-error"><CircleAlert size={12} />{error}</small> : hint ? <small>{hint}</small> : null}
    </label>
  );
}

function StudioMoneyField({ field, label, value, error, onChange }: { field: keyof StudioLimits; label: string; value: string; error?: string | undefined; onChange: (value: string) => void }) {
  return (
    <label className="studio-money-field">
      <span>{label}</span>
      <div><i>$</i><input data-studio-field={field} inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} /><code>USD</code></div>
      {error && <small className="studio-field-error"><CircleAlert size={12} />{error}</small>}
    </label>
  );
}
