"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyCodeButton({ value }: { value: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
      window.setTimeout(() => setState("idle"), 1_800);
    } catch {
      setState("failed");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void copy()}
        className="inline-flex min-h-8 items-center gap-1.5 border border-white/15 px-2.5 font-mono text-[9px] text-white/55 transition-colors hover:border-white/35 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        aria-label="Copy code"
      >
        {state === "copied" ? <Check size={11} /> : <Copy size={11} />}
        {state === "copied" ? "Copied" : state === "failed" ? "Copy blocked" : "Copy"}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {state === "copied" ? "Code copied" : state === "failed" ? "Clipboard access was blocked" : ""}
      </span>
    </>
  );
}
