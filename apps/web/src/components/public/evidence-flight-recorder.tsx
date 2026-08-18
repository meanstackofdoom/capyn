"use client";

import { gsap } from "gsap";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Clipboard,
  Download,
  Fingerprint,
  Gauge,
  Hash,
  Link2,
  Printer,
  Radio,
  RotateCw,
  ShieldCheck
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  createLabProofHref,
  deriveLabProofDecision,
  formatLabEvidenceOffset,
  verifyLabProofDigest,
  type LabProofBundle,
  type LabProofDecision
} from "@/lib/lab-proof";

type IntegrityState = "empty" | "verifying" | "match" | "mismatch" | "unavailable";
type RecorderTone = "neutral" | "permission" | "review" | "denial";

const decisionLabels: Record<LabProofDecision, string> = {
  ALLOW: "Allowed",
  APPROVED: "Human approved",
  DENY: "Denied",
  REJECTED: "Human rejected",
  REQUIRE_APPROVAL: "Waiting for human",
  UNDECIDED: "No terminal event"
};

function decisionTone(decision: LabProofDecision): RecorderTone {
  if (decision === "ALLOW" || decision === "APPROVED") return "permission";
  if (decision === "REQUIRE_APPROVAL") return "review";
  if (decision === "DENY" || decision === "REJECTED") return "denial";
  return "neutral";
}

function formatTimestamp(value: string | undefined): string {
  if (!value) return "Awaiting event";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Invalid time";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3 });
}

function formatEventType(value: string | undefined): string {
  return value?.replaceAll("_", " ") ?? "NO EVENT RECORDED";
}

function integrityCopy(state: IntegrityState): { label: string; detail: string } {
  if (state === "match") return { label: "DIGEST MATCH", detail: "Returned payload unchanged" };
  if (state === "mismatch") return { label: "DIGEST MISMATCH", detail: "Payload does not match receipt" };
  if (state === "verifying") return { label: "VERIFYING", detail: "Recomputing SHA-256 locally" };
  if (state === "unavailable") return { label: "NOT VERIFIED", detail: "Browser verification unavailable" };
  return { label: "NO RECEIPT", detail: "Run a decision to create evidence" };
}

export function EvidenceFlightRecorder({
  bundle,
  standalone = false
}: {
  bundle: LabProofBundle | null;
  standalone?: boolean | undefined;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [replayKey, setReplayKey] = useState(0);
  const [integrity, setIntegrity] = useState<IntegrityState>(bundle ? "verifying" : "empty");
  const [feedback, setFeedback] = useState<string | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const scanRef = useRef<HTMLSpanElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  const events = useMemo(() => bundle?.evidence.events ?? [], [bundle]);
  const decision = useMemo(() => deriveLabProofDecision(events), [events]);
  const tone = decisionTone(decision);
  const activeEvent = events[activeIndex];
  const integrityMessage = integrityCopy(integrity);
  const proofHref = useMemo(() => bundle ? createLabProofHref(bundle) : null, [bundle]);

  useEffect(() => {
    let active = true;
    if (!bundle) {
      setIntegrity("empty");
      return () => { active = false; };
    }
    setIntegrity("verifying");
    void verifyLabProofDigest(bundle)
      .then((matches) => { if (active) setIntegrity(matches ? "match" : "mismatch"); })
      .catch(() => { if (active) setIntegrity("unavailable"); });
    return () => { active = false; };
  }, [bundle]);

  useLayoutEffect(() => {
    timelineRef.current?.kill();
    if (!bundle || !rootRef.current || !scanRef.current || events.length === 0) {
      setActiveIndex(0);
      return;
    }

    const media = gsap.matchMedia();
    media.add(
      {
        reduceMotion: "(prefers-reduced-motion: reduce)",
        motionAllowed: "(prefers-reduced-motion: no-preference)"
      },
      (context) => {
        if (context.conditions?.reduceMotion) {
          setActiveIndex(events.length - 1);
          gsap.set(scanRef.current, { scaleX: 1 });
          return;
        }

        setActiveIndex(0);
        gsap.set(scanRef.current, { scaleX: 1 / events.length, transformOrigin: "left center" });
        gsap.fromTo(
          rootRef.current?.querySelectorAll("[data-recorder-reveal]") ?? [],
          { autoAlpha: 0, y: 10 },
          { autoAlpha: 1, duration: 0.42, ease: "power2.out", stagger: 0.055, y: 0 }
        );

        const timeline = gsap.timeline({ defaults: { ease: "power2.inOut" } });
        for (let index = 1; index < events.length; index += 1) {
          timeline
            .to(scanRef.current, { duration: 0.46, scaleX: (index + 1) / events.length })
            .call(() => setActiveIndex(index));
        }
        timelineRef.current = timeline;
      },
      rootRef
    );
    return () => {
      timelineRef.current?.kill();
      media.revert();
    };
  }, [bundle, events.length, replayKey]);

  function selectEvent(index: number, focus = false): void {
    const bounded = Math.max(0, Math.min(events.length - 1, index));
    timelineRef.current?.kill();
    setActiveIndex(bounded);
    if (scanRef.current && events.length > 0) {
      gsap.to(scanRef.current, { duration: 0.28, ease: "power2.out", scaleX: (bounded + 1) / events.length });
    }
    if (focus) {
      window.requestAnimationFrame(() => rootRef.current?.querySelector<HTMLButtonElement>(`#recorder-event-${bounded}`)?.focus());
    }
  }

  function handleEventKey(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    if (!events.length) return;
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % events.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + events.length) % events.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = events.length - 1;
    if (next === null) return;
    event.preventDefault();
    selectEvent(next, true);
  }

  async function copyProof(): Promise<void> {
    if (!bundle) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
      setFeedback("Evidence JSON copied");
      window.setTimeout(() => setFeedback(null), 1_800);
    } catch {
      setFeedback("Copy unavailable");
    }
  }

  async function copyProofLink(): Promise<void> {
    if (!proofHref) return;
    try {
      await navigator.clipboard.writeText(new URL(proofHref, window.location.origin).toString());
      setFeedback("Client-side proof link copied");
      window.setTimeout(() => setFeedback(null), 1_800);
    } catch {
      setFeedback("Copy unavailable");
    }
  }

  function downloadProof(): void {
    if (!bundle) return;
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `${bundle.evidence.receiptId.replace(/[^a-zA-Z0-9_-]/g, "-")}.json`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
    setFeedback("Evidence JSON downloaded");
    window.setTimeout(() => setFeedback(null), 1_800);
  }

  return (
    <section
      ref={rootRef}
      id="evidence-recorder"
      className={`evidence-recorder evidence-recorder--${tone} ${standalone ? "evidence-recorder--standalone" : ""}`}
      aria-label="Authority Flight Recorder"
    >
      <header className="evidence-recorder__head" data-recorder-reveal>
        <div className="evidence-recorder__title">
          <span><Radio size={12} /> 04 / Authority Flight Recorder</span>
          <h2>{bundle ? decisionLabels[decision] : "Evidence begins after the decision."}</h2>
          <p>{bundle?.evidence.receiptId ?? "The synthetic event chain will arrive here."}</p>
        </div>
        <div className={`evidence-recorder__integrity evidence-recorder__integrity--${integrity}`} role="status" aria-live="polite">
          {integrity === "mismatch" ? <AlertTriangle size={15} /> : integrity === "match" ? <Check size={15} /> : <Hash size={15} />}
          <p><strong>{integrityMessage.label}</strong><span>{integrityMessage.detail}</span></p>
        </div>
      </header>

      <div className="evidence-recorder__instrument">
        <div className="evidence-recorder__timeline" data-recorder-reveal>
          <div className="evidence-recorder__telemetry">
            <span>CHANNEL / AUTHORITY</span>
            <span>{bundle ? `${events.length} EVENTS` : "STANDBY"}</span>
            <span>SYNTHETIC / EPHEMERAL</span>
          </div>

          <div className="evidence-recorder__track" role="tablist" aria-label="Recorded evidence events">
            <span className="evidence-recorder__track-base" aria-hidden="true" />
            <span ref={scanRef} className="evidence-recorder__scan" aria-hidden="true" />
            {(events.length ? events : Array.from({ length: 3 }, (_, index) => ({ sequence: index + 1 }))).map((event, index) => {
              const recordedEvent = "type" in event ? event as (typeof events)[number] : null;
              const recorded = Boolean(recordedEvent);
              return (
                <button
                  key={event.sequence}
                  id={`recorder-event-${index}`}
                  type="button"
                  role="tab"
                  aria-selected={recorded && activeIndex === index}
                  aria-controls="recorder-active-frame"
                  disabled={!recorded}
                  data-active={recorded && activeIndex === index}
                  onClick={() => selectEvent(index)}
                  onKeyDown={(keyboardEvent) => handleEventKey(keyboardEvent, index)}
                >
                  <span>{String(event.sequence).padStart(2, "0")}</span>
                  <i />
                  <strong>{recordedEvent ? formatEventType(recordedEvent.type) : "AWAITING EVENT"}</strong>
                  <small>{recorded ? formatLabEvidenceOffset(events, index) : "T+—"}</small>
                </button>
              );
            })}
          </div>

          <article id="recorder-active-frame" className="evidence-recorder__frame" role="tabpanel" aria-live="polite">
            <div className="evidence-recorder__frame-time">
              <span>{activeEvent ? formatLabEvidenceOffset(events, activeIndex) : "T+—"}</span>
              <strong>{formatTimestamp(activeEvent?.timestamp)}</strong>
            </div>
            <div className="evidence-recorder__frame-event">
              <span>{formatEventType(activeEvent?.type)}</span>
              <strong>{activeEvent?.detail ?? "Run a policy decision to record the evidence sequence."}</strong>
            </div>
            <div className="evidence-recorder__frame-actor">
              <Fingerprint size={15} />
              <p><span>Actor</span><strong>{activeEvent?.actor ?? "not recorded"}</strong></p>
            </div>
          </article>
        </div>

        <aside className="evidence-recorder__manifest" data-recorder-reveal>
          <div className="evidence-recorder__manifest-head">
            <ShieldCheck size={16} />
            <p><span>Receipt manifest</span><strong>{bundle ? "Digest-covered fields" : "Awaiting request"}</strong></p>
          </div>
          <dl>
            <div><dt>Authorization</dt><dd>{bundle?.authorizationId ?? "—"}</dd></div>
            <div><dt>Capability</dt><dd>{bundle?.request.capability ?? "—"}</dd></div>
            <div><dt>Vendor</dt><dd>{bundle?.request.vendor.name ?? bundle?.request.vendor.id ?? "—"}</dd></div>
            <div><dt>Amount</dt><dd>{bundle ? `${bundle.request.amount.currency} ${bundle.request.amount.value}` : "—"}</dd></div>
            <div><dt>Events</dt><dd>{bundle ? `${events.length} sequential` : "—"}</dd></div>
          </dl>
          <div className="evidence-recorder__decision">
            <span>Terminal state</span>
            <strong>{decisionLabels[decision]}</strong>
          </div>
        </aside>
      </div>

      <div className="evidence-recorder__digest" data-recorder-reveal>
        <div><Hash size={14} /><span>SHA-256</span></div>
        <code>{bundle?.evidence.digest ?? "—".repeat(64)}</code>
      </div>

      <footer className="evidence-recorder__foot" data-recorder-reveal>
        <p><Gauge size={13} /> The digest checks payload integrity in this browser. It is not a signature or proof of production execution.</p>
        <div className="evidence-recorder__actions">
          <button type="button" onClick={() => setReplayKey((value) => value + 1)} disabled={!bundle}><RotateCw size={13} /> Replay</button>
          <button type="button" onClick={() => void copyProof()} disabled={!bundle}><Clipboard size={13} /> Copy JSON</button>
          <button type="button" onClick={downloadProof} disabled={!bundle}><Download size={13} /> Download</button>
          <button type="button" onClick={() => window.print()} disabled={!bundle}><Printer size={13} /> Print</button>
          {!standalone && proofHref ? <button type="button" onClick={() => void copyProofLink()}><Link2 size={13} /> Copy proof link</button> : null}
          {!standalone && proofHref ? <a href={proofHref}><ArrowUpRight size={13} /> Open proof view</a> : null}
        </div>
      </footer>
      <span className="sr-only" role="status" aria-live="polite">{feedback ?? ""}</span>
    </section>
  );
}
