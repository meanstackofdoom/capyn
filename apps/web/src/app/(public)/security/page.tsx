import Link from "next/link";
import { AlertTriangle, ArrowRight, Braces, Check, Fingerprint, KeyRound, LockKeyhole, RefreshCcw, ScrollText, ServerCog, Shield, ShieldCheck, Users } from "lucide-react";
import { Eyebrow, PublicCta, SectionHeading, TextLink } from "@/components/public/marketing-primitives";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Security",
  path: "/security",
  description: "CAPYN's fail-closed authorization model, credential handling, tenant isolation, concurrency controls, replay protection and known v0.4 limitations."
});

const controls = [
  { icon: Fingerprint, title: "Server-resolved identity", copy: "The bearer key resolves to one agent and organisation. Strict request schemas reject client-supplied agent identity." },
  { icon: KeyRound, title: "Hashed, revocable agent keys", copy: "Generated keys carry high entropy. CAPYN stores an HMAC-SHA-256 hash and short prefix, never the plaintext credential." },
  { icon: Users, title: "Organisation isolation", copy: "Every resource read and mutation is scoped with the authenticated organisation; cross-tenant lookups return not found." },
  { icon: Braces, title: "Strict input contracts", copy: "Zod schemas reject unknown fields, bound metadata size and accept money only as decimal strings converted to integer minor units." },
  { icon: LockKeyhole, title: "Request-bound approval", copy: "An approval applies once to one authorization. Hard policy is re-evaluated under lock at approval time." },
  { icon: RefreshCcw, title: "Idempotency and replay defense", copy: "Completed execution replays its stored result. Ambiguous provider outcomes hold a lease and reconcile the original execution ID instead of issuing payment again." },
  { icon: ScrollText, title: "Append-oriented audit", copy: "Repository interfaces expose append only. A PostgreSQL trigger rejects ordinary update and delete operations on historical events." },
  { icon: ServerCog, title: "Safe operational defaults", copy: "Structured logs redact credentials, bodies are capped, errors omit internal details and process-level rate limiting is enabled." }
] as const;

const limits = [
  "Human authentication is a local demo adapter, not production SSO or MFA.",
  "MockPaymentExecutor moves no real funds, so its reconciliation contract is not evidence against a real provider.",
  "Shared treasury limits across multiple agents require a treasury-level reservation lock.",
  "Rate limiting is process-local rather than backed by a distributed store.",
  "Refunds, reversals, partial capture and currency conversion are not implemented.",
  "Database administrators remain capable of changing data outside application controls."
] as const;

export default function SecurityPage() {
  return (
    <main>
      <section className="page-hero overflow-hidden border-b border-line bg-code text-white">
        <div className="authority-field-dark pointer-events-none absolute inset-0 opacity-40" />
        <div className="site-container relative grid gap-14 py-16 sm:py-24 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:py-28">
          <div>
            <Eyebrow tone="permission">Security / fail closed</Eyebrow>
            <h1 className="display-title mt-7 max-w-4xl text-balance text-5xl font-semibold leading-[.95] tracking-[-.065em] sm:text-7xl">Deny what the system cannot prove.</h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-white/60">CAPYN is designed for actions with consequences. Authority must be explicit, current, request-specific and explainable—or execution stops.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="#controls" className="inline-flex min-h-12 items-center justify-center gap-2 bg-white px-6 text-sm font-bold text-code">Inspect implemented controls <ArrowRight size={15} /></Link>
              <Link href="/dashboard/audit" className="inline-flex min-h-12 items-center justify-center gap-2 border border-white/20 px-6 text-sm font-bold text-white">View audit evidence</Link>
            </div>
          </div>
          <div className="border border-white/15 bg-white/[.035] p-6 sm:p-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-5"><span className="font-mono text-[9px] uppercase tracking-[.16em] text-white/45">Default authorization posture</span><ShieldCheck size={18} className="text-permission" /></div>
            <div className="mt-6 space-y-3">
              {["Identity established", "Active mandate found", "Every hard rule passes", "Approval valid for this request", "Execution not previously claimed"].map((item, index) => (
                <div key={item} className="grid grid-cols-[24px_1fr_auto] items-center gap-3 border border-white/10 px-4 py-3"><span className="font-mono text-[8px] text-white/35">{String(index + 1).padStart(2, "0")}</span><span className="text-xs text-white/70">{item}</span><Check size={13} className="text-permission" /></div>
              ))}
            </div>
            <div className="mt-4 border border-denial/25 bg-denial/10 p-4"><p className="font-mono text-[9px] text-denial">IF UNKNOWN → DENY</p></div>
          </div>
        </div>
      </section>

      <section id="controls" className="site-section bg-panel">
        <div className="site-container">
          <SectionHeading eyebrow="Implemented in v0.4" title="Security boundaries exist in the server and repository—not in the interface." copy="The dashboard communicates policy. It does not enforce it. These controls sit in authentication, domain services, transactions and the database model." />
          <div className="mt-14 grid gap-px border border-line bg-line md:grid-cols-2 lg:grid-cols-4">
            {controls.map(({ icon: Icon, title, copy }) => (
              <article key={title} className="bg-paper p-6 sm:p-7">
                <Icon size={18} className="text-authority" />
                <h2 className="mt-9 text-sm font-extrabold">{title}</h2>
                <p className="mt-3 text-xs leading-6 text-muted">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="concurrency" className="site-section border-y border-line">
        <div className="site-container grid gap-12 lg:grid-cols-[.82fr_1.18fr] lg:items-start">
          <div>
            <Eyebrow tone="authority">Concurrency / spend reservations</Eyebrow>
            <h2 className="display-title mt-6 text-4xl font-semibold leading-[1.02] tracking-[-.055em] sm:text-5xl">Four simultaneous requests cannot all spend the same remaining budget.</h2>
            <p className="mt-6 text-base leading-8 text-muted">CAPYN serializes authorization and approval accounting per agent, then evaluates projected spend against live reservations inside the same transaction.</p>
          </div>
          <div className="border border-line bg-panel">
            <div className="flex items-center justify-between border-b border-line px-5 py-4"><span className="font-mono text-[9px] uppercase tracking-[.15em] text-muted">Daily limit / $100</span><Shield size={16} className="text-authority" /></div>
            {[1, 2, 3, 4].map((request, index) => (
              <div key={request} className="grid grid-cols-[52px_1fr_auto] items-center gap-4 border-b border-line/70 px-5 py-4 last:border-0">
                <span className="font-mono text-[9px] text-muted">REQ {request}</span>
                <div><p className="text-xs font-extrabold">$30.00</p><p className="mt-1 font-mono text-[8px] text-muted">projected / ${index < 3 ? (index + 1) * 30 : 120}.00</p></div>
                <span className={`border px-2.5 py-1 font-mono text-[8px] ${index < 3 ? "border-permission/30 bg-permission/10 text-permission" : "border-denial/30 bg-denial/10 text-denial"}`}>{index < 3 ? "ALLOW" : "DENY"}</span>
              </div>
            ))}
            <div className="border-t border-line bg-paper px-5 py-4 font-mono text-[9px] text-muted">RESERVED TOTAL / $90.00 · HARD LIMIT PRESERVED</div>
          </div>
        </div>
      </section>

      <section className="site-section bg-code text-white">
        <div className="site-container grid gap-12 lg:grid-cols-2">
          <div>
            <Eyebrow tone="permission">Transparent scope</Eyebrow>
            <h2 className="display-title mt-6 text-4xl font-semibold tracking-[-.055em] sm:text-5xl">A developer MVP, not a claim of production certification.</h2>
            <p className="mt-6 max-w-xl text-base leading-8 text-white/60">CAPYN v0.4 adds durable hosted workspaces and scoped owner credentials to the established authority architecture. It intentionally does not custody or move real funds.</p>
            <div className="mt-8"><TextLink href="/about#roadmap" inverse>See what comes next</TextLink></div>
          </div>
          <div className="border border-white/15">
            <div className="flex items-center gap-3 border-b border-white/15 px-5 py-4"><AlertTriangle size={16} className="text-review" /><span className="font-mono text-[9px] uppercase tracking-[.15em] text-white/55">Known v0.4 limitations</span></div>
            {limits.map((limit) => <div key={limit} className="flex gap-3 border-b border-white/10 px-5 py-4 text-xs leading-6 text-white/55 last:border-0"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-review" />{limit}</div>)}
          </div>
        </div>
      </section>

      <section className="site-section">
        <div className="site-container grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
          <div className="panel p-7 sm:p-10">
            <Eyebrow>Production gate</Eyebrow>
            <h2 className="display-title mt-6 text-3xl font-semibold tracking-[-.045em]">Before any real money moves.</h2>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {["Independent threat model and review", "Real human SSO, MFA and sessions", "Treasury-level reservations", "Distributed abuse controls", "Executor outbox, worker and alerts", "External audit export and retention", "Secrets, backups and disaster recovery", "Legal and compliance review"].map((item) => <div key={item} className="flex items-start gap-3 border-t border-line py-3 text-xs font-semibold"><Check size={13} className="mt-0.5 shrink-0 text-permission" />{item}</div>)}
            </div>
          </div>
          <div className="bg-authority p-7 text-white sm:p-10">
            <ShieldCheck size={24} />
            <h2 className="display-title mt-10 text-3xl font-semibold tracking-[-.045em]">Security questions are product questions.</h2>
            <p className="mt-5 text-sm leading-7 text-white/70">Every limit, approval and audit decision is part of the public product contract—not an implementation footnote.</p>
          </div>
        </div>
      </section>

      <PublicCta />
    </main>
  );
}
