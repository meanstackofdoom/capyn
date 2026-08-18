"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, FileWarning, Link2, LockKeyhole, ScanSearch, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { EvidenceFlightRecorder } from "@/components/public/evidence-flight-recorder";
import { parseLabProofToken, type LabProofBundle } from "@/lib/lab-proof";

type ProofState =
  | { status: "loading"; bundle: null }
  | { status: "invalid"; bundle: null }
  | { status: "ready"; bundle: LabProofBundle };

export function ProofViewer() {
  const [proof, setProof] = useState<ProofState>({ status: "loading", bundle: null });

  useEffect(() => {
    function readFragment(): void {
      window.scrollTo(0, 0);
      const bundle = parseLabProofToken(window.location.hash);
      setProof(bundle ? { status: "ready", bundle } : { status: "invalid", bundle: null });
    }
    readFragment();
    window.addEventListener("hashchange", readFragment);
    return () => window.removeEventListener("hashchange", readFragment);
  }, []);

  return (
    <main className="proof-page">
      <section className="proof-hero">
        <div className="proof-hero__grid" aria-hidden="true" />
        <div className="site-container proof-hero__shell">
          <div className="proof-hero__eyebrow"><ScanSearch size={14} /> Client-side evidence viewer / synthetic receipt</div>
          <div className="proof-hero__layout">
            <div>
              <h1 className="display-title">One decision.<br /><em>Every reason.</em></h1>
              <p>Replay the actors and transitions behind a CAPYN decision, then recompute its evidence digest in your own browser.</p>
            </div>
            <div className="proof-hero__privacy">
              <LockKeyhole size={18} />
              <p><strong>The proof travels in the URL fragment.</strong><span>Your browser decodes it locally; the fragment is not sent with the HTTP request. Anyone holding the link can still read its contents.</span></p>
            </div>
          </div>
        </div>
      </section>

      <section className="proof-view">
        <div className="site-container">
          {proof.status === "loading" ? (
            <div className="proof-state" role="status">
              <span className="proof-state__scanner" aria-hidden="true" />
              <ScanSearch size={24} />
              <h2>Decoding evidence bundle</h2>
              <p>Reading the fragment and validating its schema.</p>
            </div>
          ) : proof.status === "invalid" ? (
            <div className="proof-state proof-state--invalid" role="alert">
              <FileWarning size={28} />
              <p>PROOF LINK / NOT READABLE</p>
              <h2>This receipt is missing, malformed, or from an unsupported schema.</h2>
              <span>Nothing was sent to CAPYN. Generate a fresh synthetic receipt in the Authority Lab.</span>
              <Link href="/lab">Run a new decision <ArrowRight size={15} /></Link>
            </div>
          ) : (
            <EvidenceFlightRecorder bundle={proof.bundle} standalone />
          )}
        </div>
      </section>

      <section className="proof-method">
        <div className="site-container proof-method__grid">
          <div><span>01</span><ShieldCheck size={16} /><h2>Schema first</h2><p>Unknown fields, invalid actors, malformed amounts, broken sequences and oversized fragments fail closed.</p></div>
          <div><span>02</span><Link2 size={16} /><h2>Exact payload</h2><p>The authorization, request, receipt identifier and ordered events are the same fields covered by the digest.</p></div>
          <div><span>03</span><ScanSearch size={16} /><h2>Local recomputation</h2><p>Web Crypto recomputes SHA-256 locally. A match proves integrity of this bundle—not authorship or real-world execution.</p></div>
        </div>
      </section>

      <section className="proof-return">
        <div className="site-container proof-return__inner">
          <Link href="/lab"><ArrowLeft size={14} /> Back to Authority Lab</Link>
          <p>Need the boundary behind the receipt?</p>
          <Link href="/start">Build a mandate <ArrowRight size={14} /></Link>
        </div>
      </section>
    </main>
  );
}
