import Link from "next/link";
import { ArrowRight, Braces, Check, LockKeyhole, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

export function Eyebrow({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "authority" | "permission" }) {
  return (
    <p className={`inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.17em] ${tone === "authority" ? "text-authority" : tone === "permission" ? "text-permission" : "text-muted"}`}>
      <span className="status-dot" /> {children}
    </p>
  );
}

export function SectionHeading({ eyebrow, title, copy, align = "left" }: { eyebrow: string; title: string; copy?: string; align?: "left" | "center" }) {
  return (
    <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <p className="font-mono text-[10px] uppercase tracking-[.17em] text-muted">{eyebrow}</p>
      <h2 className="display-title mt-5 text-4xl font-semibold leading-[1.03] tracking-[-.055em] sm:text-5xl">{title}</h2>
      {copy && <p className={`mt-5 max-w-2xl text-base leading-8 text-muted ${align === "center" ? "mx-auto" : ""}`}>{copy}</p>}
    </div>
  );
}

export function TextLink({ href, children, inverse = false }: { href: string; children: ReactNode; inverse?: boolean }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-2 text-sm font-bold ${inverse ? "text-white" : "text-ink"}`}>
      {children} <ArrowRight size={15} />
    </Link>
  );
}

export function CodeWindow({ label, code, children }: { label: string; code?: string; children?: ReactNode }) {
  return (
    <div className="overflow-hidden border border-slate-700 bg-code text-slate-100 shadow-[0_24px_70px_rgba(3,12,20,.18)]">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <span className="font-mono text-[9px] uppercase tracking-[.16em] text-white/50">{label}</span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[9px] text-white/45"><Braces size={11} /> typed contract</span>
      </div>
      {children ?? <pre className="overflow-x-auto p-5 font-mono text-[11px] leading-6 sm:p-6"><code>{code}</code></pre>}
    </div>
  );
}

type RailDecision = "ALLOW" | "DENY" | "REQUIRE_APPROVAL";

const decisionStyles: Record<RailDecision, string> = {
  ALLOW: "border-permission/30 bg-permission/10 text-permission",
  DENY: "border-denial/30 bg-denial/10 text-denial",
  REQUIRE_APPROVAL: "border-review/30 bg-review/10 text-review"
};

export function AuthorityRequest({ vendor = "AWS", amount = "$120.00", decision = "REQUIRE_APPROVAL", compact = false }: { vendor?: string; amount?: string; decision?: RailDecision; compact?: boolean }) {
  const trace = decision === "DENY"
    ? [["Identity", "procurement-agent", "PASS"], ["Capability", "spend.compute", "PASS"], ["Vendor", vendor, "FAIL"]]
    : [["Identity", "procurement-agent", "PASS"], ["Capability", "spend.compute", "PASS"], ["Vendor", vendor, "PASS"], ["Hard limit", "$150.00", "PASS"], ["Approval", "above $100", decision === "ALLOW" ? "PASS" : "REVIEW"]];

  return (
    <div className="authority-request border border-line bg-panel shadow-[0_30px_80px_rgba(12,32,48,.10)]">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[.16em] text-muted">Authorization request</p>
          <p className="mt-1.5 font-mono text-[11px]">auth_request_bound</p>
        </div>
        <LockKeyhole size={15} className="text-muted" />
      </div>
      <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
        {[["Agent", "procurement-agent"], ["Vendor", vendor], ["Amount", amount], ["Currency", "USD"]].map(([label, value]) => (
          <div key={label} className="min-w-0 bg-panel p-4">
            <p className="font-mono text-[8px] uppercase tracking-[.14em] text-muted">{label}</p>
            <p className="mt-2 truncate text-[11px] font-bold">{value}</p>
          </div>
        ))}
      </div>
      <div className={compact ? "p-4" : "p-5 sm:p-6"}>
        <p className="mb-4 font-mono text-[9px] uppercase tracking-[.16em] text-muted">Authority rail</p>
        <div className="authority-corridor pl-6">
          {trace.map(([rule, value, result], index) => (
            <div key={rule} className="relative grid grid-cols-[20px_1fr_auto] items-center gap-3 border-b border-line/70 py-2.5 last:border-0">
              <span className="font-mono text-[8px] text-muted">{String(index + 1).padStart(2, "0")}</span>
              <span className="min-w-0 truncate text-[11px]"><span className="text-muted">{rule}</span><span className="mx-2 text-line">/</span>{value}</span>
              <span className={`font-mono text-[8px] ${result === "PASS" ? "text-permission" : result === "REVIEW" ? "text-review" : "text-denial"}`}>{result}</span>
            </div>
          ))}
        </div>
      </div>
      <div className={`flex items-center justify-between border-t px-5 py-4 ${decisionStyles[decision]}`}>
        <div>
          <p className="font-mono text-[8px] uppercase tracking-[.16em]">Decision</p>
          <p className="mt-1 text-sm font-extrabold">{decision}</p>
        </div>
        {decision === "ALLOW" ? <Check size={18} /> : decision === "DENY" ? <span className="font-mono text-[9px]">VENDOR_NOT_ALLOWED</span> : <span className="font-mono text-[9px]">apr_72f83</span>}
      </div>
    </div>
  );
}

export function PublicCta() {
  return (
    <section className="site-section">
      <div className="site-container">
        <div className="relative overflow-hidden bg-authority px-6 py-12 text-white sm:px-10 lg:grid lg:grid-cols-[1fr_auto] lg:items-end lg:px-14 lg:py-16">
          <div className="authority-field pointer-events-none absolute inset-0 opacity-30" />
          <div className="relative max-w-2xl">
            <p className="font-mono text-[10px] uppercase tracking-[.17em] text-white/65">Start with the decision point</p>
            <h2 className="display-title mt-5 text-4xl font-semibold leading-[1.02] tracking-[-.055em] sm:text-5xl">Give the agent a mandate, not the treasury keys.</h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-white/70">Run a real policy decision in the Authority Lab, then bring one consequential action to a design-partner brief.</p>
          </div>
          <div className="relative mt-8 flex flex-col gap-3 sm:flex-row lg:mt-0 lg:flex-col">
            <Link href="/lab" className="inline-flex min-h-12 items-center justify-center gap-2 bg-white px-5 text-sm font-bold text-authority">Enter Authority Lab <ArrowRight size={15} /></Link>
            <Link href="/design-partners" className="inline-flex min-h-12 items-center justify-center gap-2 border border-white/25 px-5 text-sm font-bold text-white">Bring a real boundary <ArrowRight size={15} /></Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SecuritySeal({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center gap-2 border border-line bg-panel px-3 py-2 text-[11px] font-semibold"><ShieldCheck size={13} className="text-permission" />{children}</span>;
}
