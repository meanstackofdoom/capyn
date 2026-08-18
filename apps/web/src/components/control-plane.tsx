"use client";

import Link from "next/link";
import { PLAN_CATALOG } from "@capyn/billing";
import {
  Activity,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Clock3,
  Code2,
  CreditCard,
  FileKey2,
  Fingerprint,
  KeyRound,
  ListFilter,
  Menu,
  Plus,
  RefreshCw,
  ScrollText,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
  X,
  XCircle
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  CORE_CAPABILITIES,
  type ApprovalView,
  type AuthorizationView,
  type BillingOverview,
  type DashboardSnapshot,
  type Decision,
  type RuleTrace
} from "@capyn/types";
import { Brand } from "./brand";
import type { DashboardSection } from "@/lib/dashboard";
import { OWNER_SESSION_STORAGE_KEY } from "@/lib/production-launch";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const DEMO_USER = process.env.NEXT_PUBLIC_DEMO_USER_ID ?? "usr_demo_owner";
const DEMO_MANAGEMENT_ENABLED = process.env.NEXT_PUBLIC_DEMO_MANAGEMENT_ENABLED !== "false";
const DEMO_USER_NAME = process.env.NEXT_PUBLIC_DEMO_USER_NAME ?? "Acme Owner";
const DEMO_USER_ROLE = process.env.NEXT_PUBLIC_DEMO_USER_ROLE ?? "Owner";
const DEMO_USER_INITIALS = DEMO_USER_NAME.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

const sectionMeta: Record<DashboardSection, { label: string; description: string }> = {
  overview: { label: "Overview", description: "Authority posture and recent decisions across your organisation." },
  agents: { label: "Agents", description: "Identities, credentials and live authority assigned to autonomous software." },
  mandates: { label: "Mandates", description: "Define exactly what an agent may do, where and for how much." },
  authorizations: { label: "Authorizations", description: "Every request, decision, reason and evaluated policy gate." },
  approvals: { label: "Approvals", description: "Human review for exact requests that cross delegated thresholds." },
  audit: { label: "Audit Log", description: "An append-oriented record of consequential authority changes and actions." },
  billing: { label: "Billing", description: "Hosted plan, metered usage, retention and commercial service boundaries." },
  developers: { label: "Developers", description: "Connect an agent and request authority with a small, typed API." },
  settings: { label: "Settings", description: "Organisation-wide security posture and integration boundaries." }
};

const navigation = [
  ["overview", Activity],
  ["agents", Bot],
  ["mandates", FileKey2],
  ["authorizations", ShieldCheck],
  ["approvals", UserCheck],
  ["audit", ScrollText],
  ["billing", CreditCard],
  ["developers", Code2],
  ["settings", Settings]
] as const;

async function humanRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const ownerKey = typeof window === "undefined" ? null : window.sessionStorage.getItem(OWNER_SESSION_STORAGE_KEY);
  if (ownerKey) headers.set("Authorization", `Bearer ${ownerKey}`);
  else headers.set("x-capyn-user-id", DEMO_USER);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers, cache: "no-store" });
  const body: unknown = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = body as { error?: { message?: string } } | null;
    throw new Error(error?.error?.message ?? `Request failed (${response.status})`);
  }
  return body as T;
}

function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

function DecisionBadge({ decision }: { decision: Decision }) {
  const label = decision === "REQUIRE_APPROVAL" ? "APPROVAL" : decision;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 border px-2.5 py-1 font-mono text-[9px] font-medium tracking-[.08em]",
        decision === "ALLOW" && "border-permission/30 bg-permission/10 text-permission",
        decision === "DENY" && "border-denial/30 bg-denial/10 text-denial",
        decision === "REQUIRE_APPROVAL" && "border-review/30 bg-review/10 text-review"
      )}
    >
      <span className="status-dot" /> {label}
    </span>
  );
}

function AgentStatus({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-xs font-semibold",
        status === "ACTIVE" ? "text-permission" : status === "SUSPENDED" ? "text-review" : "text-denial"
      )}
    >
      <span className="status-dot" /> {status}
    </span>
  );
}

function Button({
  children,
  tone = "default",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "default" | "primary" | "danger" | "approve";
}) {
  return (
    <button
      className={cn(
        "inline-flex min-h-9 items-center justify-center gap-2 border px-3.5 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-45",
        tone === "default" && "border-line bg-panel hover:border-muted",
        tone === "primary" && "border-ink bg-ink text-paper hover:opacity-90",
        tone === "danger" && "border-denial/35 text-denial hover:bg-denial/10",
        tone === "approve" && "border-permission bg-permission text-white hover:opacity-90",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function EmptyState({ icon, title, copy }: { icon: ReactNode; title: string; copy: string }) {
  return (
    <div className="panel flex min-h-64 flex-col items-center justify-center px-6 text-center">
      <span className="text-muted">{icon}</span>
      <h3 className="mt-5 text-sm font-bold">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted">{copy}</p>
    </div>
  );
}

function Trace({ trace }: { trace: RuleTrace[] }) {
  return (
    <div className="authority-bracket space-y-1 py-1 pl-6">
      {trace.map((item, index) => (
        <div key={`${item.rule}-${index}`} className="grid grid-cols-[24px_1fr_auto] items-start gap-3 border-b border-line/70 py-3 last:border-0">
          <span className="pt-0.5 font-mono text-[9px] text-muted">{String(index + 1).padStart(2, "0")}</span>
          <div className="min-w-0">
            <p className="text-xs font-bold">{item.rule}</p>
            <p className="mt-1 break-words font-mono text-[9px] leading-4 text-muted">{item.reasonCode}</p>
            {item.details && (
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[9px] text-muted">
                {Object.entries(item.details).map(([key, value]) => <span key={key}>{key}: {value}</span>)}
              </div>
            )}
          </div>
          <span className={cn("font-mono text-[9px]", item.result === "PASS" ? "text-permission" : item.result === "REVIEW" ? "text-review" : "text-denial")}>
            {item.result}
          </span>
        </div>
      ))}
    </div>
  );
}

function formatTime(value: string): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function Metric({ label, value, annotation }: { label: string; value: string | number; annotation?: string }) {
  return (
    <div className="panel min-w-0 p-5">
      <p className="font-mono text-[9px] uppercase tracking-[.14em] text-muted">{label}</p>
      <p className="mono-number mt-5 truncate text-3xl font-medium tracking-[-.06em]">{value}</p>
      {annotation && <p className="mt-2 text-[11px] text-muted">{annotation}</p>}
    </div>
  );
}

function AuthorizationTable({
  authorizations,
  onSelect
}: {
  authorizations: AuthorizationView[];
  onSelect: (authorization: AuthorizationView) => void;
}) {
  if (!authorizations.length) {
    return <EmptyState icon={<Shield size={24} />} title="No authorization requests" copy="Requests from authenticated agents will appear here with their complete decision evidence." />;
  }
  return (
    <div className="panel w-full max-w-full overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left">
        <thead>
          <tr className="border-b border-line font-mono text-[9px] uppercase tracking-[.12em] text-muted">
            <th className="px-5 py-3 font-normal">Agent</th>
            <th className="px-5 py-3 font-normal">Capability</th>
            <th className="px-5 py-3 font-normal">Vendor</th>
            <th className="px-5 py-3 text-right font-normal">Amount</th>
            <th className="px-5 py-3 font-normal">Decision</th>
            <th className="px-5 py-3 font-normal">Time</th>
          </tr>
        </thead>
        <tbody>
          {authorizations.map((authorization) => (
            <tr
              key={authorization.id}
              className="cursor-pointer border-b border-line/70 text-xs transition-colors last:border-0 hover:bg-paper"
              onClick={() => onSelect(authorization)}
            >
              <td className="px-5 py-4 font-semibold">{authorization.agentName}</td>
              <td className="px-5 py-4 font-mono text-[10px]">{authorization.capability}</td>
              <td className="px-5 py-4">{authorization.vendor.name ?? authorization.vendor.id}</td>
              <td className="mono-number px-5 py-4 text-right">${authorization.amount.value}</td>
              <td className="px-5 py-4"><DecisionBadge decision={authorization.decision} /></td>
              <td className="px-5 py-4 text-muted">{formatTime(authorization.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuthorizationDetail({ authorization, onClose }: { authorization: AuthorizationView; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/30 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="Authorization detail">
      <button className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Close authorization detail" />
      <aside className="relative h-full w-full max-w-xl overflow-y-auto border-l border-line bg-panel p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[.15em] text-muted">Authorization evidence</p>
            <h2 className="mt-2 font-mono text-sm font-medium">{authorization.id}</h2>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center border border-line" aria-label="Close"><X size={16} /></button>
        </div>
        <div className="mt-7 grid grid-cols-2 gap-px border border-line bg-line">
          {[
            ["Agent", authorization.agentName],
            ["Decision", authorization.decision],
            ["Vendor", authorization.vendor.name ?? authorization.vendor.id],
            ["Amount", `$${authorization.amount.value} ${authorization.amount.currency}`],
            ["Capability", authorization.capability],
            ["State", authorization.state]
          ].map(([label, value]) => (
            <div key={label} className="bg-paper p-4">
              <p className="font-mono text-[8px] uppercase tracking-[.13em] text-muted">{label}</p>
              <p className="mt-2 break-words text-xs font-semibold">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-8">
          <p className="mb-4 font-mono text-[9px] uppercase tracking-[.15em] text-muted">Evaluation trace</p>
          <Trace trace={authorization.trace} />
        </div>
        <div className="mt-8 border border-line bg-paper p-4">
          <p className="font-mono text-[9px] uppercase tracking-[.13em] text-muted">Decision reasons</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {authorization.reasonCodes.map((reason) => <span key={reason} className="border border-line bg-panel px-2 py-1 font-mono text-[9px]">{reason}</span>)}
          </div>
        </div>
      </aside>
    </div>
  );
}

export function ControlPlane({ section }: { section: DashboardSection }) {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [billing, setBilling] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedAuthorization, setSelectedAuthorization] = useState<AuthorizationView | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ownerSession, setOwnerSession] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextSnapshot, nextBilling] = await Promise.all([
        humanRequest<DashboardSnapshot>("/v1/dashboard"),
        humanRequest<BillingOverview>("/v1/billing")
      ]);
      setSnapshot(nextSnapshot);
      setBilling(nextBilling);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not reach CAPYN API");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setOwnerSession(Boolean(window.sessionStorage.getItem(OWNER_SESSION_STORAGE_KEY)));
    void load();
  }, [load]);
  useEffect(() => { setMobileOpen(false); }, [section]);

  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 4200);
  };

  const setOwnerKey = async (apiKey: string): Promise<void> => {
    const previous = window.sessionStorage.getItem(OWNER_SESSION_STORAGE_KEY);
    window.sessionStorage.setItem(OWNER_SESSION_STORAGE_KEY, apiKey);
    try {
      const [nextSnapshot, nextBilling] = await Promise.all([
        humanRequest<DashboardSnapshot>("/v1/dashboard"),
        humanRequest<BillingOverview>("/v1/billing")
      ]);
      setSnapshot(nextSnapshot);
      setBilling(nextBilling);
      setError(null);
      setOwnerSession(true);
      notify("Owner key session opened for this tab.");
    } catch (caught) {
      if (previous) window.sessionStorage.setItem(OWNER_SESSION_STORAGE_KEY, previous);
      else window.sessionStorage.removeItem(OWNER_SESSION_STORAGE_KEY);
      throw caught;
    }
  };

  const endOwnerSession = async (): Promise<void> => {
    window.sessionStorage.removeItem(OWNER_SESSION_STORAGE_KEY);
    setOwnerSession(false);
    await load();
    notify("Owner key removed from this tab.");
  };

  const operatorName = snapshot?.operator?.name ?? DEMO_USER_NAME;
  const operatorRole = snapshot?.operator?.role ?? DEMO_USER_ROLE;
  const operatorInitials = operatorName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const canAdmin = ownerSession || DEMO_MANAGEMENT_ENABLED;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className={cn("fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-line bg-panel transition-transform lg:translate-x-0", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex h-[72px] items-center justify-between border-b border-line px-5">
          <Brand />
          <button className="lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>
        <div className="border-b border-line px-5 py-5">
          <p className="font-mono text-[8px] uppercase tracking-[.15em] text-muted">Organisation</p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="truncate text-sm font-bold">{snapshot?.organisation.name ?? "Acme AI"}</p>
            <ChevronRight size={14} className="text-muted" />
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Control plane">
          {navigation.map(([id, Icon]) => (
            <Link
              key={id}
              href={id === "overview" ? "/dashboard" : `/dashboard/${id}`}
              className={cn(
                "flex h-10 items-center gap-3 border px-3 text-xs font-semibold transition-colors",
                section === id ? "border-line bg-paper text-ink" : "border-transparent text-muted hover:bg-paper hover:text-ink"
              )}
            >
              <Icon size={15} strokeWidth={section === id ? 2.2 : 1.7} />
              {sectionMeta[id].label}
              {id === "approvals" && (snapshot?.stats.approvalsWaiting ?? 0) > 0 && (
                <span className="ml-auto min-w-5 bg-review/15 px-1.5 py-0.5 text-center font-mono text-[9px] text-review">{snapshot?.stats.approvalsWaiting}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="border-t border-line p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center bg-ink text-[10px] font-bold text-paper">{operatorInitials || DEMO_USER_INITIALS}</div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold">{operatorName}</p>
              <p className="font-mono text-[8px] uppercase tracking-[.12em] text-muted">{operatorRole} · {ownerSession ? "owner key" : "demo auth"}</p>
            </div>
          </div>
        </div>
      </aside>

      {mobileOpen && <button className="fixed inset-0 z-30 bg-ink/30 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation backdrop" />}

      <main className="min-w-0 lg:col-start-2">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-line bg-paper/90 px-5 backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-3">
            <button className="grid h-9 w-9 place-items-center border border-line lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={17} /></button>
            <div>
              <h1 className="text-sm font-extrabold">{sectionMeta[section].label}</h1>
              <p className="mt-0.5 hidden text-[10px] text-muted sm:block">{sectionMeta[section].description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 font-mono text-[9px] uppercase tracking-[.12em] text-muted sm:flex"><span className="status-dot text-permission" /> Policy service healthy</span>
            <button className="grid h-9 w-9 place-items-center border border-line bg-panel" onClick={() => void load()} aria-label="Refresh data"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /></button>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] p-5 sm:p-8">
          {!canAdmin && (
            <div className="mb-5 border border-review/30 bg-review/10 px-4 py-3 text-[11px] leading-5 text-muted">
              <strong className="text-ink">Public demonstration:</strong> organisation administration is disabled. The scoped approver can inspect evidence and decide exact pending requests; state is synthetic and disposable.
            </div>
          )}
          {loading && !snapshot ? <LoadingState /> : error ? <ErrorState error={error} retry={() => void load()} ownerSession={ownerSession} clearOwnerKey={() => void endOwnerSession()} /> : snapshot ? (
            <div className="enter-control">
              {section === "overview" && <Overview snapshot={snapshot} selectAuthorization={setSelectedAuthorization} />}
              {section === "agents" && <Agents snapshot={snapshot} reload={load} notify={notify} canAdmin={canAdmin} />}
              {section === "mandates" && <Mandates snapshot={snapshot} reload={load} notify={notify} canAdmin={canAdmin} />}
              {section === "authorizations" && <Authorizations snapshot={snapshot} selectAuthorization={setSelectedAuthorization} />}
              {section === "approvals" && <Approvals snapshot={snapshot} reload={load} notify={notify} />}
              {section === "audit" && <AuditLog snapshot={snapshot} />}
              {section === "billing" && billing && <BillingPanel billing={billing} reload={load} notify={notify} />}
              {section === "developers" && <Developers snapshot={snapshot} notify={notify} />}
              {section === "settings" && <SettingsPage snapshot={snapshot} ownerSession={ownerSession} setOwnerKey={setOwnerKey} endOwnerSession={endOwnerSession} />}
            </div>
          ) : null}
        </div>
      </main>

      {selectedAuthorization && <AuthorizationDetail authorization={selectedAuthorization} onClose={() => setSelectedAuthorization(null)} />}
      {notice && <div className="fixed bottom-5 right-5 z-[60] flex max-w-sm items-center gap-3 border border-permission/30 bg-panel px-4 py-3 text-xs font-semibold shadow-xl"><CheckCircle2 size={16} className="text-permission" />{notice}</div>}
    </div>
  );
}

function LoadingState() {
  return <div className="grid gap-4 md:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-32 animate-pulse border border-line bg-panel" />)}</div>;
}

function ErrorState({ error, retry, ownerSession, clearOwnerKey }: { error: string; retry: () => void; ownerSession: boolean; clearOwnerKey: () => void }) {
  return (
    <div className="panel mx-auto mt-16 max-w-xl p-8">
      <ShieldAlert size={25} className="text-denial" />
      <h2 className="mt-6 text-xl font-bold">The control plane API is unavailable</h2>
      <p className="mt-3 text-sm leading-6 text-muted">{error}</p>
      <div className="mt-5 bg-paper p-4 font-mono text-[10px] leading-5 text-muted">pnpm dev<br />API expected at {API_BASE}</div>
      <div className="mt-5 flex flex-wrap gap-2"><Button onClick={retry}><RefreshCw size={13} /> Try again</Button>{ownerSession && <Button tone="danger" onClick={clearOwnerKey}><X size={13} /> Clear invalid owner key</Button>}</div>
    </div>
  );
}

function Overview({ snapshot, selectAuthorization }: { snapshot: DashboardSnapshot; selectAuthorization: (authorization: AuthorizationView) => void }) {
  const activeMandates = snapshot.agents.filter((agent) => agent.mandate);
  return (
    <div className="min-w-0 space-y-7">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Metric label="Active agents" value={snapshot.stats.activeAgents} />
        <Metric label="Active mandates" value={snapshot.stats.activeMandates} />
        <Metric label="Spend today" value={`$${snapshot.stats.spendToday}`} annotation="reserved + executed" />
        <Metric label="Awaiting review" value={snapshot.stats.approvalsWaiting} />
        <Metric label="Allowed today" value={snapshot.stats.allowedRequests} />
        <Metric label="Denied today" value={snapshot.stats.deniedRequests} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.5fr_.5fr]">
        <section className="min-w-0">
          <div className="mb-4 flex items-end justify-between">
            <div><p className="font-mono text-[9px] uppercase tracking-[.15em] text-muted">Decision stream</p><h2 className="mt-2 text-lg font-bold">Recent authorization activity</h2></div>
            <Link href="/dashboard/authorizations" className="text-xs font-semibold text-muted hover:text-ink">View all</Link>
          </div>
          <AuthorizationTable authorizations={snapshot.authorizations.slice(0, 8)} onSelect={selectAuthorization} />
        </section>
        <section className="min-w-0">
          <div className="mb-4"><p className="font-mono text-[9px] uppercase tracking-[.15em] text-muted">Authority posture</p><h2 className="mt-2 text-lg font-bold">Live mandates</h2></div>
          <div className="panel divide-y divide-line">
            {activeMandates.length ? activeMandates.map((agent) => (
              <div key={agent.id} className="p-5">
                <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold">{agent.name}</p><p className="mt-1 font-mono text-[9px] text-muted">{agent.mandate?.name} · v{agent.mandate?.version}</p></div><AgentStatus status={agent.status} /></div>
                <div className="mt-4 flex flex-wrap gap-1.5">{agent.mandate?.capabilities.map((capability) => <span key={capability} className="bg-paper px-2 py-1 font-mono text-[9px]">{capability}</span>)}</div>
                <div className="mt-5 flex justify-between border-t border-line pt-4 text-[10px] text-muted"><span>Today <strong className="mono-number text-ink">${agent.spendToday}</strong></span><span>Month <strong className="mono-number text-ink">${agent.spendMonth}</strong></span></div>
              </div>
            )) : <div className="p-6 text-sm text-muted">No active mandates.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}

function Agents({ snapshot, reload, notify, canAdmin }: { snapshot: DashboardSnapshot; reload: () => Promise<void>; notify: (message: string) => void; canAdmin: boolean }) {
  const [showCreate, setShowCreate] = useState(false);
  const [issuedKey, setIssuedKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const createAgent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const result = await humanRequest<{ credential: { apiKey: string } }>("/v1/agents", {
        method: "POST",
        body: JSON.stringify({ name: data.get("name"), slug: data.get("slug"), description: data.get("description") || undefined })
      });
      setIssuedKey(result.credential.apiKey);
      await reload();
      notify("Agent created. Copy its API key now; CAPYN will not show it again.");
    } catch (caught) { notify(caught instanceof Error ? caught.message : "Could not create agent"); }
    finally { setBusy(false); }
  };

  const setStatus = async (id: string, status: string) => {
    setBusy(true);
    try {
      await humanRequest(`/v1/agents/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      await reload(); notify(`Agent ${status.toLowerCase()}.`);
    } catch (caught) { notify(caught instanceof Error ? caught.message : "Could not update agent"); }
    finally { setBusy(false); }
  };

  const newCredential = async (id: string) => {
    setBusy(true);
    try {
      const result = await humanRequest<{ apiKey: string }>(`/v1/agents/${id}/credentials`, { method: "POST" });
      setIssuedKey(result.apiKey); notify("New credential created. Copy it before closing this notice.");
      await reload();
    } catch (caught) { notify(caught instanceof Error ? caught.message : "Could not create credential"); }
    finally { setBusy(false); }
  };

  const rotateCredential = async (agentId: string, credentialId: string) => {
    if (!window.confirm("Rotate this credential now? The existing key will stop working immediately.")) return;
    const storageKey = `capyn:credential-rotation:${agentId}:${credentialId}`;
    const idempotencyKey = window.sessionStorage.getItem(storageKey) ?? `credential-rotation-${crypto.randomUUID()}`;
    window.sessionStorage.setItem(storageKey, idempotencyKey);
    setBusy(true);
    try {
      const result = await humanRequest<{ apiKey: string }>(
        `/v1/agents/${agentId}/credentials/${credentialId}/rotate`,
        { method: "POST", headers: { "Idempotency-Key": idempotencyKey } }
      );
      window.sessionStorage.removeItem(storageKey);
      setIssuedKey(result.apiKey);
      await reload();
      notify("Credential rotated atomically. Copy the replacement key now; the previous key is revoked.");
    } catch (caught) {
      notify(caught instanceof Error ? `${caught.message} Retry to recover the same rotation result.` : "Could not rotate credential");
    } finally { setBusy(false); }
  };

  const revokeCredential = async (agentId: string, credentialId: string) => {
    if (!window.confirm("Revoke this credential? Requests using it will be rejected immediately.")) return;
    setBusy(true);
    try {
      await humanRequest(`/v1/agents/${agentId}/credentials/${credentialId}`, { method: "DELETE" });
      await reload();
      notify("Credential revoked.");
    } catch (caught) { notify(caught instanceof Error ? caught.message : "Could not revoke credential"); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><p className="text-sm text-muted">{snapshot.agents.length} registered identities</p>{canAdmin ? <Button tone="primary" onClick={() => { setShowCreate((value) => !value); setIssuedKey(null); }}><Plus size={14} /> Create agent</Button> : <span className="font-mono text-[9px] uppercase tracking-[.12em] text-muted">Administration disabled</span>}</div>
      {showCreate && canAdmin && (
        <form className="panel grid gap-4 p-5 md:grid-cols-[1fr_1fr_1.4fr_auto] md:items-end" onSubmit={(event) => void createAgent(event)}>
          <label className="text-xs font-semibold">Name<input required name="name" placeholder="research-agent" className="mt-2 h-10 w-full border border-line bg-paper px-3 text-sm outline-none" /></label>
          <label className="text-xs font-semibold">Slug<input required name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="research-agent" className="mt-2 h-10 w-full border border-line bg-paper px-3 font-mono text-xs outline-none" /></label>
          <label className="text-xs font-semibold">Description<input name="description" placeholder="What this agent is responsible for" className="mt-2 h-10 w-full border border-line bg-paper px-3 text-sm outline-none" /></label>
          <Button tone="primary" disabled={busy}>Create identity</Button>
        </form>
      )}
      {issuedKey && <SecretNotice secret={issuedKey} onClose={() => setIssuedKey(null)} />}
      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {snapshot.agents.map((agent) => (
          <article key={agent.id} className="panel p-5">
            <div className="flex items-start justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center border border-line bg-paper"><Bot size={18} /></div><div className="min-w-0"><h2 className="truncate text-sm font-bold">{agent.name}</h2><p className="mt-1 truncate font-mono text-[9px] text-muted">{agent.id}</p></div></div><AgentStatus status={agent.status} /></div>
            <p className="mt-5 min-h-10 text-xs leading-5 text-muted">{agent.description ?? "No description supplied."}</p>
            <div className="mt-5 border-y border-line py-4">
              <div className="flex items-center justify-between"><span className="font-mono text-[9px] uppercase tracking-[.12em] text-muted">Credentials</span><span className="font-mono text-[10px]">{agent.credentials.filter((credential) => credential.status === "ACTIVE").length} active</span></div>
              <div className="mt-3 space-y-2">
                {agent.credentials.length ? agent.credentials.slice(0, 4).map((credential) => (
                  <div className="border border-line bg-paper p-3" key={credential.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><p className="truncate font-mono text-[9px]">{credential.keyPrefix}••••</p><p className="mt-1 text-[9px] text-muted">Created {formatTime(credential.createdAt)}{credential.lastUsedAt ? ` · used ${formatTime(credential.lastUsedAt)}` : " · unused"}</p></div>
                      <span className={cn("font-mono text-[8px]", credential.status === "ACTIVE" ? "text-permission" : "text-muted")}>{credential.status}</span>
                    </div>
                    {canAdmin && credential.status === "ACTIVE" && (
                      <div className="mt-3 flex gap-2 border-t border-line pt-3">
                        <Button disabled={busy} onClick={() => void rotateCredential(agent.id, credential.id)}><RefreshCw size={11} /> Rotate key</Button>
                        <Button tone="danger" disabled={busy} onClick={() => void revokeCredential(agent.id, credential.id)}><XCircle size={11} /> Revoke key</Button>
                      </div>
                    )}
                  </div>
                )) : <p className="text-[10px] text-muted">No credentials issued.</p>}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-line pt-4"><span className="font-mono text-[9px] uppercase tracking-[.12em] text-muted">Mandate</span><span className="text-[10px] font-semibold">{agent.mandate ? `${agent.mandate.name} v${agent.mandate.version}` : "Not assigned"}</span></div>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">{agent.mandate?.capabilities.map((capability) => <span className="bg-paper px-2 py-1 font-mono text-[9px]" key={capability}>{capability}</span>)}</div>
            <div className="mt-5 grid grid-cols-2 gap-px bg-line"><div className="bg-paper p-3"><p className="font-mono text-[8px] text-muted">TODAY</p><p className="mono-number mt-1 text-sm font-medium">${agent.spendToday}</p></div><div className="bg-paper p-3"><p className="font-mono text-[8px] text-muted">MONTH</p><p className="mono-number mt-1 text-sm font-medium">${agent.spendMonth}</p></div></div>
            {canAdmin ? <div className="mt-5 flex flex-wrap gap-2"><Button disabled={busy} onClick={() => void newCredential(agent.id)}><KeyRound size={12} /> New key</Button>{agent.status === "ACTIVE" ? <Button disabled={busy} onClick={() => void setStatus(agent.id, "SUSPENDED")}><Clock3 size={12} /> Suspend agent</Button> : agent.status === "SUSPENDED" ? <Button disabled={busy} onClick={() => void setStatus(agent.id, "ACTIVE")}><Check size={12} /> Reactivate agent</Button> : null}<Button tone="danger" disabled={busy || agent.status === "REVOKED"} onClick={() => void setStatus(agent.id, "REVOKED")}><XCircle size={12} /> Revoke agent</Button></div> : <p className="mt-5 border-t border-line pt-4 text-[10px] text-muted">Identity controls are hidden in the public demonstration.</p>}
          </article>
        ))}
      </div>
    </div>
  );
}

function SecretNotice({ secret, onClose }: { secret: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="border border-review/40 bg-review/10 p-5">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold text-review">Copy this API key now</p><p className="mt-1 text-[11px] text-muted">It is hashed before storage and cannot be recovered later.</p></div><button onClick={onClose} aria-label="Close"><X size={15} /></button></div>
      <div className="mt-4 flex items-center gap-2 border border-line bg-panel p-3"><code className="min-w-0 flex-1 break-all font-mono text-[10px]">{secret}</code><Button onClick={() => { void navigator.clipboard.writeText(secret); setCopied(true); }}><Clipboard size={12} /> {copied ? "Copied" : "Copy"}</Button></div>
    </div>
  );
}

function Mandates({ snapshot, reload, notify, canAdmin }: { snapshot: DashboardSnapshot; reload: () => Promise<void>; notify: (message: string) => void; canAdmin: boolean }) {
  const [agentId, setAgentId] = useState(snapshot.agents[0]?.id ?? "");
  const [capabilities, setCapabilities] = useState<string[]>(["spend.compute", "spend.api"]);
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canAdmin) { notify("Mandate activation is disabled in the public demonstration."); return; }
    const data = new FormData(event.currentTarget); setBusy(true);
    try {
      const field = (name: string): string => {
        const value = data.get(name);
        return typeof value === "string" ? value : "";
      };
      const vendors = field("vendors").split(",").map((value) => value.trim()).filter(Boolean).map((name) => ({ id: name.toLowerCase().replace(/[^a-z0-9_-]+/g, "-"), name }));
      await humanRequest("/v1/mandates", { method: "POST", body: JSON.stringify({ agentId, name: field("name"), capabilities, allowedVendors: vendors, limits: { perTransaction: { value: field("transaction"), currency: "USD" }, daily: { value: field("daily"), currency: "USD" }, monthly: { value: field("monthly"), currency: "USD" }, approvalAbove: { value: field("approval"), currency: "USD" } }, validUntil: new Date(`${field("validUntil")}T00:00:00.000Z`).toISOString() }) });
      await reload(); notify("New mandate version activated; the previous active version was revoked.");
    } catch (caught) { notify(caught instanceof Error ? caught.message : "Could not activate mandate"); }
    finally { setBusy(false); }
  };
  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
      <form className="panel p-6 sm:p-8" onSubmit={(event) => void submit(event)}>
        <div className="flex items-start justify-between"><div><p className="font-mono text-[9px] uppercase tracking-[.14em] text-muted">Mandate builder</p><h2 className="mt-2 text-xl font-bold tracking-[-.03em]">Delegate bounded authority</h2></div><FileKey2 className="text-muted" size={21} /></div>
        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          <label className="text-xs font-semibold">Agent<select value={agentId} onChange={(event) => setAgentId(event.target.value)} className="mt-2 h-11 w-full border border-line bg-paper px-3 text-sm">{snapshot.agents.map((agent) => <option value={agent.id} key={agent.id}>{agent.name}</option>)}</select></label>
          <label className="text-xs font-semibold">Mandate name<input name="name" required defaultValue="Procurement authority" className="mt-2 h-11 w-full border border-line bg-paper px-3 text-sm" /></label>
        </div>
        <fieldset className="mt-7"><legend className="font-mono text-[9px] uppercase tracking-[.14em] text-muted">Capabilities</legend><div className="mt-3 grid gap-2 sm:grid-cols-2">{CORE_CAPABILITIES.map((capability) => <label key={capability} className="flex cursor-pointer items-center gap-3 border border-line bg-paper p-3 text-xs"><input type="checkbox" checked={capabilities.includes(capability)} onChange={(event) => setCapabilities((current) => event.target.checked ? [...current, capability] : current.filter((item) => item !== capability))} className="accent-[var(--permission)]" /><span className="font-mono text-[10px]">{capability}</span>{capability === "transfer.wallet" && <span className="ml-auto text-[9px] text-denial">sensitive</span>}</label>)}</div></fieldset>
        <label className="mt-7 block text-xs font-semibold">Approved vendors<input required name="vendors" defaultValue="OpenAI, Anthropic, AWS" className="mt-2 h-11 w-full border border-line bg-paper px-3 text-sm" /><span className="mt-2 block text-[10px] font-normal text-muted">Comma-separated. Unknown vendor IDs fail closed.</span></label>
        <div className="mt-7 grid gap-4 sm:grid-cols-2"><MoneyField name="transaction" label="Hard per transaction" value="150.00" /><MoneyField name="daily" label="Per UTC day" value="200.00" /><MoneyField name="monthly" label="Per calendar month" value="2000.00" /><MoneyField name="approval" label="Require approval above" value="100.00" /></div>
        <label className="mt-6 block text-xs font-semibold">Valid until<input name="validUntil" type="date" required defaultValue="2026-09-30" className="mt-2 h-11 w-full border border-line bg-paper px-3 text-sm sm:w-64" /></label>
        {!canAdmin && <p className="mt-6 border border-review/30 bg-review/10 p-3 text-[10px] leading-5 text-muted">Preview the policy shape here. Activation is intentionally disabled for the public approver identity.</p>}
        <div className="mt-8 flex items-center justify-between border-t border-line pt-6"><p className="max-w-sm text-[10px] leading-5 text-muted">Activation is versioned and auditable. Only one mandate may be active for an agent.</p><Button tone="primary" disabled={!canAdmin || busy || !agentId || capabilities.length === 0}>{!canAdmin ? "Preview only" : busy ? "Activating…" : "Activate mandate"}</Button></div>
      </form>
      <div>
        <p className="mb-4 font-mono text-[9px] uppercase tracking-[.14em] text-muted">Current delegated authority</p>
        <div className="space-y-3">{snapshot.agents.map((agent) => <article className="panel p-5" key={agent.id}><div className="flex items-start justify-between"><div><h3 className="text-sm font-bold">{agent.name}</h3><p className="mt-1 font-mono text-[9px] text-muted">{agent.mandate ? `${agent.mandate.name} · version ${agent.mandate.version}` : "No active mandate"}</p></div>{agent.mandate ? <ShieldCheck size={17} className="text-permission" /> : <ShieldAlert size={17} className="text-review" />}</div>{agent.mandate && <><div className="mt-4 flex flex-wrap gap-1.5">{agent.mandate.capabilities.map((capability) => <span className="border border-line bg-paper px-2 py-1 font-mono text-[9px]" key={capability}>{capability}</span>)}</div><p className="mt-4 text-[10px] text-muted">Expires {formatTime(agent.mandate.validUntil)}</p></>}</article>)}</div>
      </div>
    </div>
  );
}

function MoneyField({ name, label, value }: { name: string; label: string; value: string }) {
  return <label className="text-xs font-semibold">{label}<div className="mt-2 flex h-11 border border-line bg-paper"><span className="grid w-10 place-items-center border-r border-line font-mono text-xs text-muted">$</span><input required name={name} defaultValue={value} pattern="(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,2})?" className="mono-number min-w-0 flex-1 bg-transparent px-3 text-sm outline-none" /><span className="grid w-12 place-items-center font-mono text-[9px] text-muted">USD</span></div></label>;
}

function Authorizations({ snapshot, selectAuthorization }: { snapshot: DashboardSnapshot; selectAuthorization: (authorization: AuthorizationView) => void }) {
  const [decision, setDecision] = useState("ALL");
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => snapshot.authorizations.filter((authorization) => (decision === "ALL" || authorization.decision === decision) && [authorization.agentName, authorization.capability, authorization.vendor.id, authorization.vendor.name ?? ""].some((value) => value.toLowerCase().includes(query.toLowerCase()))), [snapshot.authorizations, decision, query]);
  return <div className="space-y-5"><div className="flex flex-col gap-3 sm:flex-row"><div className="flex h-10 flex-1 items-center gap-2 border border-line bg-panel px-3"><ListFilter size={14} className="text-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter agent, capability or vendor" className="min-w-0 flex-1 bg-transparent text-xs outline-none" /></div><select value={decision} onChange={(event) => setDecision(event.target.value)} className="h-10 border border-line bg-panel px-3 text-xs"><option value="ALL">All decisions</option><option value="ALLOW">Allow</option><option value="DENY">Deny</option><option value="REQUIRE_APPROVAL">Approval</option></select></div><AuthorizationTable authorizations={filtered} onSelect={selectAuthorization} /></div>;
}

function Approvals({ snapshot, reload, notify }: { snapshot: DashboardSnapshot; reload: () => Promise<void>; notify: (message: string) => void }) {
  const [comments, setComments] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const pending = snapshot.approvals.filter((approval) => approval.status === "PENDING");
  const decide = async (approval: ApprovalView, decision: "APPROVE" | "REJECT") => {
    setBusy(approval.id);
    try { await humanRequest(`/v1/approvals/${approval.id}/decision`, { method: "POST", body: JSON.stringify({ decision, comment: comments[approval.id] || undefined }) }); await reload(); notify(decision === "APPROVE" ? "Exact authorization approved." : "Authorization rejected."); }
    catch (caught) { notify(caught instanceof Error ? caught.message : "Could not decide approval"); }
    finally { setBusy(null); }
  };
  return <div className="space-y-6">{pending.length ? <div className="grid gap-4 xl:grid-cols-2">{pending.map((approval) => <article className="border border-review/30 bg-panel p-5 shadow-control" key={approval.id}><div className="flex items-start justify-between gap-4"><div><p className="font-mono text-[9px] uppercase tracking-[.14em] text-review">Human decision required</p><h2 className="mt-2 text-base font-bold">{approval.agentName} <span className="font-normal text-muted">→</span> {approval.vendor.name ?? approval.vendor.id}</h2></div><span className="mono-number text-xl font-medium">${approval.amount.value}</span></div><div className="mt-5 grid grid-cols-2 gap-px bg-line text-xs"><div className="bg-paper p-3"><span className="text-muted">Capability</span><p className="mt-1 font-mono text-[10px]">{approval.capability}</p></div><div className="bg-paper p-3"><span className="text-muted">Mandate</span><p className="mt-1 font-semibold">{approval.mandateName ?? "—"}</p></div></div><div className="mt-4 border-l-2 border-review pl-4"><p className="text-[10px] text-muted">Purpose</p><p className="mt-1 text-xs leading-5">{approval.purpose ?? "No purpose supplied"}</p><p className="mt-2 font-mono text-[9px] text-review">{approval.triggeredBy}</p></div><textarea value={comments[approval.id] ?? ""} onChange={(event) => setComments((current) => ({ ...current, [approval.id]: event.target.value }))} placeholder="Optional decision comment" maxLength={500} className="mt-5 min-h-20 w-full resize-y border border-line bg-paper p-3 text-xs outline-none" /><div className="mt-3 flex justify-end gap-2"><Button tone="danger" disabled={busy === approval.id} onClick={() => void decide(approval, "REJECT")}><X size={13} /> Reject</Button><Button tone="approve" disabled={busy === approval.id} onClick={() => void decide(approval, "APPROVE")}><Check size={13} /> Approve exact request</Button></div></article>)}</div> : <EmptyState icon={<UserCheck size={24} />} title="No approvals waiting" copy="Requests above a mandate’s approval threshold will pause here before execution." />}{snapshot.approvals.some((approval) => approval.status !== "PENDING") && <div><p className="mb-3 font-mono text-[9px] uppercase tracking-[.14em] text-muted">Decision history</p><div className="panel divide-y divide-line">{snapshot.approvals.filter((approval) => approval.status !== "PENDING").map((approval) => <div key={approval.id} className="grid gap-3 p-4 text-xs sm:grid-cols-[1fr_1fr_auto_auto] sm:items-center"><span className="font-semibold">{approval.agentName}</span><span>{approval.vendor.name ?? approval.vendor.id} · ${approval.amount.value}</span><span className={approval.status === "APPROVED" ? "text-permission" : "text-denial"}>{approval.status}</span><span className="text-muted">{approval.decidedAt ? formatTime(approval.decidedAt) : "—"}</span></div>)}</div></div>}</div>;
}

function AuditLog({ snapshot }: { snapshot: DashboardSnapshot }) {
  const [actor, setActor] = useState("ALL"); const [event, setEvent] = useState("");
  const filtered = snapshot.auditEvents.filter((item) => (actor === "ALL" || item.actorType === actor) && item.eventType.toLowerCase().includes(event.toLowerCase()));
  return <div className="space-y-5"><div className="flex flex-col gap-3 sm:flex-row"><div className="flex h-10 flex-1 items-center gap-2 border border-line bg-panel px-3"><ListFilter size={14} className="text-muted" /><input value={event} onChange={(e) => setEvent(e.target.value)} placeholder="Filter event type" className="flex-1 bg-transparent text-xs outline-none" /></div><select className="h-10 border border-line bg-panel px-3 text-xs" value={actor} onChange={(e) => setActor(e.target.value)}><option value="ALL">All actors</option><option value="USER">User</option><option value="AGENT">Agent</option><option value="SYSTEM">System</option></select></div><div className="panel"><div className="border-b border-line px-5 py-4"><div className="flex items-center gap-2 text-xs font-bold"><Fingerprint size={15} /> Append-oriented event stream</div><p className="mt-1 text-[10px] text-muted">Historical events cannot be modified through the application repository.</p></div><div className="divide-y divide-line">{filtered.map((item) => <div key={item.id} className="grid gap-3 px-5 py-4 text-xs md:grid-cols-[130px_95px_1fr_1fr] md:items-start"><span className="text-muted">{formatTime(item.timestamp)}</span><span className="font-mono text-[9px]">{item.actorType}</span><div><p className="font-bold">{item.eventType}</p><p className="mt-1 font-mono text-[9px] text-muted">{item.entityType} / {item.entityId}</p></div><div className="flex flex-wrap gap-1.5">{Object.entries(item.metadata).slice(0, 4).map(([key, value]) => <span key={key} className="bg-paper px-2 py-1 font-mono text-[8px] text-muted">{key}: {typeof value === "string" || typeof value === "number" ? String(value) : "…"}</span>)}</div></div>)}</div></div></div>;
}

const billingMetricLabels = {
  AUTHORIZATION_DECISION: "Authorization decisions",
  ACTIVE_AGENT: "Active agents",
  APPROVAL_REQUEST: "Approval requests",
  AUDIT_EVENT: "Audit events",
  INTEGRATION_CONNECTION: "Integration connections"
} as const;

function formatCurrency(cents: number | null): string {
  if (cents === null) return "Custom";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

function BillingPanel({
  billing,
  reload,
  notify
}: {
  billing: BillingOverview;
  reload: () => Promise<void>;
  notify: (message: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const healthySubscription = billing.subscriptionStatus === "ACTIVE" || billing.subscriptionStatus === "TRIALING";
  const subscriptionTone = healthySubscription
    ? "border-permission/30 bg-permission/10 text-permission"
    : billing.subscriptionStatus === "PAST_DUE"
      ? "border-review/30 bg-review/10 text-review"
      : "border-denial/30 bg-denial/10 text-denial";
  const startCheckout = async (planId: "TEAM" | "BUSINESS") => {
    setBusy(planId);
    try {
      const session = await humanRequest<{ url: string }>("/v1/billing/checkout", {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ planId })
      });
      window.location.assign(session.url);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Could not start checkout");
      setBusy(null);
    }
  };
  const openPortal = async () => {
    setBusy("PORTAL");
    try {
      const session = await humanRequest<{ url: string }>("/v1/billing/portal", { method: "POST" });
      window.location.assign(session.url);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Could not open the billing portal");
      setBusy(null);
    }
  };

  return (
    <div className="space-y-7">
      <section className="grid gap-px border border-line bg-line lg:grid-cols-[1.05fr_.95fr]">
        <div className="bg-panel p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[.15em] text-authority">Hosted authority plan</p>
              <h2 className="display-title mt-3 text-4xl font-semibold tracking-[-.055em]">{billing.planName}</h2>
              <p className="mt-3 max-w-lg text-sm leading-7 text-muted">
                {billing.basePriceCents === 0 ? "Free hosted evaluation with firm usage boundaries." : "Managed authority infrastructure with included capacity and metered overage."}
              </p>
            </div>
            <span className={cn("inline-flex items-center gap-2 border px-3 py-2 font-mono text-[9px]", subscriptionTone)}>
              <span className="status-dot" /> {billing.subscriptionStatus}
            </span>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
            <div className="bg-paper p-4"><p className="font-mono text-[8px] text-muted">BASE / MONTH</p><p className="mono-number mt-2 text-lg font-semibold">{formatCurrency(billing.basePriceCents)}</p></div>
            <div className="bg-paper p-4"><p className="font-mono text-[8px] text-muted">PROJECTED</p><p className="mono-number mt-2 text-lg font-semibold">{formatCurrency(billing.estimatedMonthlyCents)}</p></div>
            <div className="bg-paper p-4"><p className="font-mono text-[8px] text-muted">AUDIT ACCESS</p><p className="mono-number mt-2 text-lg font-semibold">{billing.auditRetentionDays ? `${billing.auditRetentionDays}d` : "Contract"}</p></div>
            <div className="bg-paper p-4"><p className="font-mono text-[8px] text-muted">PROVIDER</p><p className="mt-2 text-sm font-semibold">{billing.provider}</p></div>
          </div>
          <p className="mt-5 font-mono text-[9px] leading-5 text-muted">
            Period {new Date(billing.currentPeriodStart).toLocaleDateString("en-AU")} → {new Date(billing.currentPeriodEnd).toLocaleDateString("en-AU")}
          </p>
        </div>
        <div className="bg-paper p-6 sm:p-8">
          <p className="font-mono text-[9px] uppercase tracking-[.15em] text-muted">What the base plan funds</p>
          <div className="mt-6 space-y-5">
            {[
              ["Approval workflows", billing.approvalWorkflows],
              ["Reliability", billing.reliability],
              ["Compliance boundary", billing.compliance]
            ].map(([label, value]) => (
              <div key={label} className="border-l border-authority pl-4">
                <p className="text-xs font-bold">{label}</p>
                <p className="mt-1 text-[11px] leading-5 text-muted">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-7 flex flex-wrap gap-2">
            {billing.customerPortalAvailable && <Button onClick={() => void openPortal()} disabled={busy !== null}><CreditCard size={13} /> Manage payment</Button>}
            <Button onClick={() => void reload()} disabled={busy !== null}><RefreshCw size={13} /> Refresh usage</Button>
            <Link href="/pricing" className="inline-flex min-h-9 items-center border border-line bg-panel px-3.5 text-xs font-bold">Compare plans</Link>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4">
          <p className="font-mono text-[9px] uppercase tracking-[.15em] text-muted">Usage rail</p>
          <h2 className="mt-2 text-lg font-bold">Exact metered boundaries</h2>
        </div>
        <div className="panel divide-y divide-line">
          {billing.usage.map((line) => {
            const percentage = line.included === null || line.included === 0 ? 0 : Math.min(100, (line.used / line.included) * 100);
            return (
              <div key={line.metric} className="grid gap-4 p-5 lg:grid-cols-[220px_1fr_190px] lg:items-center">
                <div>
                  <p className="text-xs font-bold">{billingMetricLabels[line.metric]}</p>
                  <p className="mt-1 font-mono text-[8px] text-muted">{line.enforcement}</p>
                </div>
                <div>
                  <div className="flex justify-between gap-4 font-mono text-[9px] text-muted">
                    <span>{line.used.toLocaleString()} used</span>
                    <span>{line.included === null ? "Included / contract" : `${line.included.toLocaleString()} included`}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden bg-wash" aria-label={`${billingMetricLabels[line.metric]} usage`}>
                    <div className={cn("h-full", line.overage > 0 ? "bg-review" : "bg-authority")} style={{ width: `${percentage}%` }} />
                  </div>
                </div>
                <div className="text-left lg:text-right">
                  <p className="mono-number text-xs font-semibold">{line.projectedChargeCents ? `${formatCurrency(line.projectedChargeCents)} projected` : "No usage charge"}</p>
                  {line.overage > 0 && <p className="mt-1 font-mono text-[8px] text-review">{line.overage.toLocaleString()} over included</p>}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[10px] leading-5 text-muted">Approval requests and audit events remain visible usage signals; CAPYN does not add a per-approval penalty or delete historical evidence after a downgrade.</p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {(["TEAM"] as const).map((planId) => {
          const plan = PLAN_CATALOG[planId];
          const current = billing.planId === planId;
          const canCheckout = billing.planId === "DEVELOPER" &&
            (!billing.customerPortalAvailable || billing.subscriptionStatus === "CANCELED");
          return (
            <article key={planId} className={cn("panel p-6 sm:p-7", current && "border-authority")}>
              <div className="flex items-start justify-between gap-5">
                <div><p className="font-mono text-[9px] uppercase tracking-[.14em] text-muted">{plan.audience}</p><h2 className="mt-3 text-xl font-extrabold">{plan.name}</h2></div>
                <p className="mono-number text-xl font-semibold">{formatCurrency(plan.basePriceCents)}<span className="text-[10px] font-normal text-muted"> / mo</span></p>
              </div>
              <div className="mt-6 grid gap-2 text-xs text-muted">
                {plan.features.slice(0, 4).map((feature) => <p className="flex items-center gap-2" key={feature}><Check size={12} className="text-permission" />{feature}</p>)}
              </div>
              <div className="mt-7">
                {current ? <Button disabled className="w-full">Current plan</Button> : canCheckout ? <Button tone="primary" className="w-full" disabled={!billing.checkoutAvailable || busy !== null} onClick={() => void startCheckout(planId)}>{busy === planId ? "Opening checkout…" : billing.checkoutAvailable ? `Choose ${plan.name}` : "Stripe checkout not configured"}</Button> : billing.customerPortalAvailable ? <Button className="w-full" disabled={busy !== null} onClick={() => void openPortal()}>Change plan in billing portal</Button> : <Button disabled className="w-full">Manage changes in billing portal</Button>}
              </div>
            </article>
          );
        })}
        <article className={cn("panel p-6 sm:p-7", billing.planId === "BUSINESS" && "border-authority")}>
          <div className="flex items-start justify-between gap-5">
            <div><p className="font-mono text-[9px] uppercase tracking-[.14em] text-muted">Operational agent systems</p><h2 className="mt-3 text-xl font-extrabold">Production</h2></div>
            <p className="mono-number text-xl font-semibold">Custom</p>
          </div>
          <div className="mt-6 grid gap-2 text-xs text-muted">
            {["Written adapter and reconciliation scope", "Contracted infrastructure and capacity", "Custom evidence retention", "Explicit support and reliability boundary"].map((feature) => <p className="flex items-center gap-2" key={feature}><Check size={12} className="text-permission" />{feature}</p>)}
          </div>
          <div className="mt-7">
            {billing.planId === "BUSINESS" ? <Button disabled className="w-full">Current contracted plan</Button> : <Link href="/design-partners" className="inline-flex min-h-9 w-full items-center justify-center border border-line bg-panel px-3.5 text-xs font-bold">Discuss production scope</Link>}
          </div>
        </article>
      </section>
    </div>
  );
}

function Developers({ snapshot, notify }: { snapshot: DashboardSnapshot; notify: (message: string) => void }) {
  const agent = snapshot.agents[0];
  const curl = `curl -X POST ${API_BASE}/v1/authorize \\\n+  -H "Authorization: Bearer $CAPYN_API_KEY" \\\n+  -H "Idempotency-Key: inference-order-0001" \\\n+  -H "Content-Type: application/json" \\\n+  -d '{\n    "capability": "spend.compute",\n    "amount": { "value": "18.42", "currency": "USD" },\n    "vendor": { "id": "openai", "name": "OpenAI" },\n    "metadata": { "purpose": "Purchase inference capacity" }\n  }'`;
  const sdk = `import { Capyn } from "@capyn/sdk";\n\nconst capyn = new Capyn({\n  apiKey: process.env.CAPYN_API_KEY!\n});\n\nconst result = await capyn.authorize({\n  capability: "spend.compute",\n  amount: { value: "18.42", currency: "USD" },\n  vendor: { id: "openai" },\n  metadata: { purpose: "Purchase inference capacity" }\n});\n\nif (result.decision !== "ALLOW") return;`;
  return <div className="grid gap-6 xl:grid-cols-[.65fr_1.35fr]"><div className="space-y-4"><div className="panel p-5"><p className="font-mono text-[9px] uppercase tracking-[.14em] text-muted">Agent identity</p><div className="mt-4 flex items-center gap-3"><Bot size={18} /><div><p className="text-sm font-bold">{agent?.name ?? "No agent"}</p><p className="mt-1 font-mono text-[9px] text-muted">{agent?.keyPrefix ? `${agent.keyPrefix}••••` : "Create a credential on Agents"}</p></div></div></div><div className="panel p-5"><p className="font-mono text-[9px] uppercase tracking-[.14em] text-muted">REST surface</p><div className="mt-4 space-y-3">{[["GET", "/v1/me"], ["GET", "/v1/mandate"], ["POST", "/v1/authorize"], ["GET", "/v1/authorizations/:id"], ["POST", "/v1/authorizations/:id/execute"]].map(([method, path]) => <div className="flex gap-3 font-mono text-[9px]" key={path}><span className={method === "POST" ? "text-review" : "text-permission"}>{method}</span><span>{path}</span></div>)}</div></div><div className="border border-line bg-paper p-4 text-[10px] leading-5 text-muted"><strong className="text-ink">Identity boundary:</strong> the API key determines the agent. The request schema rejects client-supplied agent IDs.</div></div><div className="space-y-5"><CodeBlock label="curl" code={curl} notify={notify} /><CodeBlock label="TypeScript · @capyn/sdk" code={sdk} notify={notify} /></div></div>;
}

function CodeBlock({ label, code, notify }: { label: string; code: string; notify: (message: string) => void }) {
  return <div className="overflow-hidden border border-line bg-[color:#0b1014] text-[color:#dce5e1]"><div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><span className="font-mono text-[9px] uppercase tracking-[.13em] text-white/50">{label}</span><button className="flex items-center gap-2 font-mono text-[9px] text-white/60 hover:text-white" onClick={() => { void navigator.clipboard.writeText(code); notify("Code copied."); }}><Clipboard size={11} /> Copy</button></div><pre className="overflow-x-auto p-5 font-mono text-[10px] leading-6"><code>{code}</code></pre></div>;
}

function SettingsPage({ snapshot, ownerSession, setOwnerKey, endOwnerSession }: { snapshot: DashboardSnapshot; ownerSession: boolean; setOwnerKey: (apiKey: string) => Promise<void>; endOwnerSession: () => Promise<void> }) {
  const [key, setKey] = useState("");
  const [keyError, setKeyError] = useState<string | null>(null);
  const [keyBusy, setKeyBusy] = useState(false);

  async function openOwnerSession(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const candidate = key.trim();
    if (!candidate.startsWith("capyn_owner_live_") || candidate.length < 32) {
      setKeyError("Paste the capyn_owner_live_ key from your recovery bundle.");
      return;
    }
    setKeyBusy(true);
    setKeyError(null);
    try {
      await setOwnerKey(candidate);
      setKey("");
    } catch (caught) {
      setKeyError(caught instanceof Error ? caught.message : "The owner key could not be verified.");
    } finally {
      setKeyBusy(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="panel p-6">
        <div className="flex items-center gap-3"><Shield size={19} /><div><h2 className="text-sm font-bold">Security posture</h2><p className="mt-1 text-[10px] text-muted">Enforced on the server</p></div></div>
        <div className="mt-6 divide-y divide-line">{[["Policy default", "Fail closed"], ["Money representation", "Integer minor units"], ["Organisation isolation", "Repository-scoped"], ["Authorization lifetime", "15 minutes"], ["Audit model", "Append-oriented"]].map(([label, value]) => <div className="flex justify-between gap-3 py-3 text-xs" key={label}><span className="text-muted">{label}</span><span className="font-semibold">{value}</span></div>)}</div>
      </section>
      <section className="panel p-6">
        <div className="flex items-center gap-3"><SlidersHorizontal size={19} /><div><h2 className="text-sm font-bold">Runtime boundaries</h2><p className="mt-1 text-[10px] text-muted">What is durable and what remains simulated</p></div></div>
        <div className="mt-6 space-y-3">{[["Human authentication", ownerSession ? "Scoped owner access key" : "Public demo adapter", ownerSession ? "ok" : "review"], ["Agent authentication", "HMAC-digested API keys", "ok"], ["Persistence", "Durable tenant repository", "ok"], ["Payment executor", "MockPaymentExecutor", "review"], ["Settlement", "Live-money adapter not connected", "muted"]].map(([label, value, state]) => <div className="border border-line bg-paper p-4" key={label}><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold">{label}</span><span className={cn("status-dot", state === "ok" ? "text-permission" : state === "review" ? "text-review" : "text-muted")} /></div><p className="mt-2 font-mono text-[9px] text-muted">{value}</p></div>)}</div>
      </section>
      <section className="panel p-6 lg:col-span-2">
        <div className="flex items-center gap-3"><KeyRound size={19} /><div><h2 className="text-sm font-bold">Owner key session</h2><p className="mt-1 text-[10px] text-muted">Kept in this browser tab only; never written to CAPYN in plaintext</p></div></div>
        {ownerSession ? (
          <div className="mt-6 flex flex-col gap-4 border border-permission/30 bg-permission/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-xs font-bold text-ink">Authenticated as {snapshot.operator?.name ?? "workspace owner"}</p><p className="mt-1 font-mono text-[9px] text-muted">OWNER · KEY SESSION · {snapshot.operator?.email ?? "TENANT SCOPED"}</p></div>
            <Button tone="danger" onClick={() => void endOwnerSession()}><XCircle size={13} /> End session</Button>
          </div>
        ) : (
          <form className="mt-6" onSubmit={(event) => void openOwnerSession(event)}>
            <label className="block"><span className="text-xs font-semibold">Open an existing workspace</span><span className="mt-1 block text-[10px] leading-5 text-muted">Retrieve the owner key from the recovery bundle you downloaded at launch.</span><input type="password" autoComplete="off" spellCheck={false} value={key} onChange={(event) => { setKey(event.target.value); setKeyError(null); }} placeholder="capyn_owner_live_…" className="mt-3 h-11 w-full border border-line bg-paper px-3 font-mono text-[10px] outline-none focus:border-ink" /></label>
            {keyError && <p className="mt-2 text-[10px] text-denial">{keyError}</p>}
            <Button className="mt-4" tone="primary" type="submit" disabled={keyBusy}><KeyRound size={13} /> {keyBusy ? "Verifying…" : "Verify owner key"}</Button>
          </form>
        )}
      </section>
      <section className="panel p-6 lg:col-span-2">
        <p className="font-mono text-[9px] uppercase tracking-[.14em] text-muted">Organisation identifiers</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-3"><div><p className="text-[10px] text-muted">Name</p><p className="mt-1 text-sm font-bold">{snapshot.organisation.name}</p></div><div><p className="text-[10px] text-muted">Slug</p><p className="mt-1 font-mono text-xs">{snapshot.organisation.slug}</p></div><div><p className="text-[10px] text-muted">ID</p><p className="mt-1 font-mono text-xs">{snapshot.organisation.id}</p></div></div>
      </section>
    </div>
  );
}
