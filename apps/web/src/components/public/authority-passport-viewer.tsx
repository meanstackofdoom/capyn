"use client";

import Link from "next/link";
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  FileWarning,
  Fingerprint,
  KeyRound,
  Link2,
  LockKeyhole,
  PencilLine,
  ScanLine,
  ShieldCheck,
  TriangleAlert
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  createAuthorityPassportHref,
  createMandateDraftFromAuthorityPassport,
  createReferenceAuthorityPassportEnvelope,
  parseAuthorityPassportToken,
  type AuthorityPassportEnvelope,
  verifyAuthorityPassportEnvelope
} from "@/lib/authority-passport";
import { MANDATE_STUDIO_STORAGE_KEY, serializeStoredMandateDraft } from "@/lib/mandate-studio";

type PassportState =
  | { status: "loading" }
  | { status: "invalid" }
  | { status: "ready"; envelope: AuthorityPassportEnvelope; integrity: "match" | "mismatch"; source: "reference" | "shared" };

type ActionState = "idle" | "copied" | "downloaded" | "copy-failed";

function money(value: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(Number(value));
}

function issuedDate(value: string): string {
  return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function passportCode(digest: string): string {
  return `AP-${digest.slice(0, 4)}-${digest.slice(4, 8)}-${digest.slice(8, 12)}`.toUpperCase();
}

function DigestGlyph({ digest }: { digest: string }) {
  const cells = Array.from({ length: 25 }, (_, index) => {
    const row = Math.floor(index / 5);
    const column = index % 5;
    const mirroredColumn = column > 2 ? 4 - column : column;
    const nibble = Number.parseInt(digest[row * 3 + mirroredColumn] ?? "0", 16);
    return nibble >= 8;
  });
  return (
    <div className="passport-glyph" aria-hidden="true">
      {cells.map((active, index) => <i key={index} className={active ? "is-active" : ""} />)}
    </div>
  );
}

export function AuthorityPassportViewer() {
  const [state, setState] = useState<PassportState>({ status: "loading" });
  const [action, setAction] = useState<ActionState>("idle");

  useEffect(() => {
    let active = true;
    async function readFragment(): Promise<void> {
      window.scrollTo(0, 0);
      setAction("idle");
      if (!window.location.hash) {
        const envelope = await createReferenceAuthorityPassportEnvelope();
        if (active) setState({ status: "ready", envelope, integrity: "match", source: "reference" });
        return;
      }
      const envelope = parseAuthorityPassportToken(window.location.hash);
      if (!envelope) {
        if (active) setState({ status: "invalid" });
        return;
      }
      const integrity = await verifyAuthorityPassportEnvelope(envelope) ? "match" : "mismatch";
      if (active) setState({ status: "ready", envelope, integrity, source: "shared" });
    }
    function handleHashChange(): void {
      void readFragment();
    }

    void readFragment();
    window.addEventListener("hashchange", handleHashChange);
    return () => {
      active = false;
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  async function copyPassport(envelope: AuthorityPassportEnvelope): Promise<void> {
    try {
      const url = new URL(createAuthorityPassportHref(envelope), window.location.origin).toString();
      await navigator.clipboard.writeText(url);
      setAction("copied");
      window.setTimeout(() => setAction("idle"), 1_800);
    } catch {
      setAction("copy-failed");
    }
  }

  function downloadPassport(envelope: AuthorityPassportEnvelope): void {
    const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: "application/json" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `${envelope.passport.identity.proposedAgentSlug}-authority-passport.json`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
    setAction("downloaded");
    window.setTimeout(() => setAction("idle"), 1_800);
  }

  function editInStudio(envelope: AuthorityPassportEnvelope): void {
    const draft = createMandateDraftFromAuthorityPassport(envelope.passport);
    window.localStorage.setItem(MANDATE_STUDIO_STORAGE_KEY, serializeStoredMandateDraft(draft));
    window.location.assign("/start");
  }

  return (
    <main className="passport-page">
      <section className="passport-stage">
        <div className="passport-stage__field" aria-hidden="true" />
        <div className="site-container passport-stage__shell">
          <header className="passport-intro">
            <div>
              <p><ScanLine size={14} /> Authority Passport / client-side verifier</p>
              <h1 className="display-title">Authority that can travel <em>without becoming permission.</em></h1>
            </div>
            <aside>
              <LockKeyhole size={17} />
              <p><strong>The payload stays in the URL fragment.</strong><span>Your browser reads it locally. Anyone holding the link can read it too, so never include secrets or customer data.</span></p>
            </aside>
          </header>

          {state.status === "loading" ? (
            <div className="passport-state" role="status">
              <span aria-hidden="true" />
              <ScanLine size={24} />
              <h2>Reading authority passport</h2>
              <p>Validating the schema and recomputing its digest.</p>
            </div>
          ) : state.status === "invalid" ? (
            <div className="passport-state passport-state--invalid" role="alert">
              <FileWarning size={30} />
              <p>PASSPORT / NOT READABLE</p>
              <h2>This link is missing required fields, oversized, or uses an unsupported schema.</h2>
              <span>Nothing was submitted to CAPYN. Build a fresh browser-local mandate and issue another passport.</span>
              <Link href="/start">Build a fresh passport <ArrowRight size={15} /></Link>
            </div>
          ) : (
            <PassportInstrument
              state={state}
              action={action}
              onCopy={() => void copyPassport(state.envelope)}
              onDownload={() => downloadPassport(state.envelope)}
              onEdit={() => editInStudio(state.envelope)}
            />
          )}
        </div>
      </section>

      <section className="passport-method">
        <div className="site-container passport-method__grid">
          <article><span>FRAGMENT</span><Link2 size={17} /><h2>Portable without upload</h2><p>The complete draft travels after <code>#</code>, which browsers do not send as part of the HTTP request.</p></article>
          <article><span>SHA-256</span><ScanLine size={17} /><h2>Integrity, recomputed</h2><p>The viewer canonicalizes the passport and recomputes its digest locally. Changed fields break the seam.</p></article>
          <article><span>DRAFT ONLY</span><ShieldCheck size={17} /><h2>Legible, not activated</h2><p>A match proves this bundle is internally intact. It is not a signature, credential, production mandate or execution record.</p></article>
        </div>
      </section>

      <section className="passport-return">
        <div className="site-container passport-return__inner">
          <div><p>Need a different boundary?</p><span>Issue a new passport from a complete Mandate Studio draft.</span></div>
          <Link href="/start">Build an Authority Passport <ArrowRight size={15} /></Link>
        </div>
      </section>
    </main>
  );
}

function PassportInstrument({
  state,
  action,
  onCopy,
  onDownload,
  onEdit
}: {
  state: Extract<PassportState, { status: "ready" }>;
  action: ActionState;
  onCopy: () => void;
  onDownload: () => void;
  onEdit: () => void;
}) {
  const { envelope, integrity, source } = state;
  const { passport, digest } = envelope;
  const match = integrity === "match";
  const label = source === "reference" ? "REFERENCE / SYNTHETIC" : "SHARED / BROWSER-LOCAL";

  return (
    <div className={`passport-instrument passport-instrument--${integrity}`}>
      <article className="passport-document" aria-label={`Authority Passport for ${passport.identity.proposedAgentSlug}`}>
        <div className="passport-document__microtext" aria-hidden="true">CAPYN · DRAFT ONLY · NOT A CREDENTIAL · NOT ACTIVE AUTHORITY · VERIFY BEFORE USE ·</div>
        <header className="passport-document__head">
          <div><Fingerprint size={18} /><p><span>CAPYN / AUTHORITY PASSPORT</span><strong>{passportCode(digest)}</strong></p></div>
          <p><span>{label}</span><strong>{issuedDate(passport.issuedAt)}</strong></p>
        </header>

        <div className="passport-document__identity">
          <div>
            <p>Proposed agent identity</p>
            <h2 className="display-title">{passport.identity.proposedAgentSlug}</h2>
            <span>{passport.mandate.name}</span>
          </div>
          <DigestGlyph digest={digest} />
        </div>

        <div className="passport-document__purpose">
          <p>Exact consequential action</p>
          <strong>{passport.mandate.purpose}</strong>
        </div>

        <div className="passport-document__boundary">
          <section>
            <p>Capabilities granted</p>
            <div>{passport.mandate.capabilities.map((capability) => <code key={capability}>{capability}</code>)}</div>
          </section>
          <section>
            <p>Counterparties allowed</p>
            <div>{passport.mandate.allowedVendors.map((vendor) => <span key={vendor.id}><strong>{vendor.name}</strong><code>{vendor.id}</code></span>)}</div>
          </section>
        </div>

        <div className="passport-document__limits">
          <div className="passport-limit passport-limit--allow"><span>Autonomous corridor</span><strong>≤ {money(passport.mandate.limits.approvalAbove.value)}</strong><small>Inside every other rule</small></div>
          <div className="passport-limit passport-limit--human"><span>Human line</span><strong>&gt; {money(passport.mandate.limits.approvalAbove.value)}</strong><small>One exact request only</small></div>
          <div className="passport-limit passport-limit--stop"><span>Hard stop</span><strong>&gt; {money(passport.mandate.limits.perActionHard.value)}</strong><small>Cannot be overridden</small></div>
        </div>

        <dl className="passport-document__ledger">
          <div><dt>Daily hard limit</dt><dd>{money(passport.mandate.limits.dailyHard.value)}</dd></div>
          <div><dt>Monthly hard limit</dt><dd>{money(passport.mandate.limits.monthlyHard.value)}</dd></div>
          <div><dt>Proposed validity</dt><dd>{passport.mandate.validityDays} days</dd></div>
          <div><dt>Schema</dt><dd>authority-passport/v{passport.schemaVersion}</dd></div>
        </dl>

        <footer className="passport-document__foot">
          <div><KeyRound size={13} /><p><span>SHA-256 digest</span><code>{digest}</code></p></div>
          <strong>{match ? <><Check size={13} /> SEAM ALIGNED</> : <><TriangleAlert size={13} /> SEAM BROKEN</>}</strong>
        </footer>
      </article>

      <aside className="passport-verifier" aria-label="Passport verification result">
        <div className="passport-verifier__status">
          {match ? <ShieldCheck size={20} /> : <TriangleAlert size={20} />}
          <p><span>Local verification</span><strong>{match ? "DIGEST MATCH" : "DIGEST MISMATCH"}</strong></p>
        </div>
        <div className="passport-verifier__checks">
          <p><span>01</span><strong>Schema</strong><em>V1 / READABLE</em></p>
          <p><span>02</span><strong>Boundary</strong><em>STRUCTURALLY VALID</em></p>
          <p><span>03</span><strong>Digest</strong><em>{match ? "RECOMPUTED / MATCH" : "RECOMPUTED / FAIL"}</em></p>
        </div>
        <div className="passport-verifier__truth">
          <p><LockKeyhole size={13} /><span><strong>Not a signature.</strong>This digest does not prove who issued the fields.</span></p>
          <p><ShieldCheck size={13} /><span><strong>Not active authority.</strong>No account, credential or policy was created.</span></p>
          <p><Link2 size={13} /><span><strong>Readable by the holder.</strong>Treat the link like the document it contains.</span></p>
        </div>
        <div className="passport-verifier__actions">
          <button type="button" onClick={onCopy}><Copy size={14} />{action === "copied" ? "Link copied" : "Copy passport link"}</button>
          <button type="button" onClick={onDownload}><Download size={14} />{action === "downloaded" ? "JSON downloaded" : "Download passport JSON"}</button>
          <button type="button" onClick={onEdit} disabled={!match}><PencilLine size={14} />Edit in Mandate Studio</button>
        </div>
        {action === "copy-failed" && <p className="passport-verifier__error" role="alert">Clipboard access was blocked. Copy the current browser URL instead.</p>}
        <span className="sr-only" role="status" aria-live="polite">
          {action === "copied" ? "Authority Passport link copied" : action === "downloaded" ? "Authority Passport JSON downloaded" : ""}
        </span>
      </aside>
    </div>
  );
}
