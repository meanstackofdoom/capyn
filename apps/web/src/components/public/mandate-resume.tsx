"use client";

import Link from "next/link";
import { ArrowRight, FileKey2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import {
  MANDATE_STUDIO_STORAGE_KEY,
  getMandateStudioStatus,
  parseStoredMandateDraft,
  type StoredMandateStudioDraft
} from "@/lib/mandate-studio";

export function MandateResume() {
  const [stored, setStored] = useState<StoredMandateStudioDraft | null>(null);

  useEffect(() => {
    const value = window.localStorage.getItem(MANDATE_STUDIO_STORAGE_KEY);
    setStored(value ? parseStoredMandateDraft(value) : null);
  }, []);

  const progress = stored ? getMandateStudioStatus(stored.draft) : null;

  return (
    <section className="mandate-resume" aria-label="Mandate Studio">
      <div className="site-container mandate-resume__grid">
        <div className="mandate-resume__mark"><FileKey2 size={18} /><span>M/01</span></div>
        <div className="mandate-resume__copy">
          <p>{stored ? "BROWSER-LOCAL DRAFT / READY TO RESUME" : "MANDATE STUDIO / GUIDED ACTIVATION"}</p>
          <h2>{stored ? stored.draft.mandateName : "Turn one real action into a testable mandate."}</h2>
        </div>
        <div className="mandate-resume__status">
          <ShieldCheck size={14} />
          <p><strong>{progress ? progress.status : "NO ACCOUNT NEEDED"}</strong><span>{progress ? `${progress.completed}/${progress.total} boundary groups valid` : "Saved in this browser"}</span></p>
        </div>
        <Link href="/start">{stored ? "Resume draft" : "Start building"} <ArrowRight size={15} /></Link>
      </div>
    </section>
  );
}
