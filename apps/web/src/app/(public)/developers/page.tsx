import Link from "next/link";
import { ArrowRight, Braces, Clock3, Github, KeyRound, LockKeyhole, Play, TerminalSquare } from "lucide-react";
import { CodeWindow, Eyebrow, PublicCta, SectionHeading, TextLink } from "@/components/public/marketing-primitives";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Developers",
  path: "/developers",
  description: "Authorize agent actions with CAPYN's typed TypeScript SDK and REST API. Explore request contracts, reason codes, idempotency and execution."
});

const sdkExample = `import { Capyn } from "@capyn/sdk";

const capyn = new Capyn({
  apiKey: process.env.CAPYN_API_KEY!
});

const result = await capyn.authorize({
  capability: "spend.compute",
  amount: {
    value: "18.42",
    currency: "USD"
  },
  vendor: { id: "openai" },
  metadata: {
    purpose: "Purchase inference capacity"
  }
});

if (result.decision === "ALLOW") {
  // Continue with this exact action.
}`;

const repositoryUrl = "https://github.com/meanstackofdoom/capyn";
const quickStart = `git clone https://github.com/meanstackofdoom/capyn.git
cd capyn
corepack pnpm install
corepack pnpm demo`;

const curlExample = `curl -X POST http://localhost:4000/v1/authorize \\
  -H "Authorization: Bearer $CAPYN_API_KEY" \\
  -H "Idempotency-Key: inference-order-0001" \\
  -H "Content-Type: application/json" \\
  -d '{
    "capability": "spend.compute",
    "amount": { "value": "18.42", "currency": "USD" },
    "vendor": { "id": "openai", "name": "OpenAI" },
    "metadata": { "purpose": "Inference capacity" }
  }'`;

const endpoints = [
  ["GET", "/v1/me", "Resolve the authenticated agent identity."],
  ["GET", "/v1/mandate", "Inspect the agent's current active authority."],
  ["POST", "/v1/authorize", "Request a decision for one consequential action."],
  ["GET", "/v1/authorizations/:id", "Retrieve the request, decision and policy trace."],
  ["POST", "/v1/authorizations/:id/execute", "Execute one valid authorization through the configured adapter."]
] as const;

const responses = [
  { label: "ALLOW", color: "permission", body: `{
  "decision": "ALLOW",
  "authorizationId": "auth_12928",
  "reasonCodes": [
    "CAPABILITY_ALLOWED",
    "VENDOR_ALLOWED",
    "DAILY_LIMIT_OK"
  ]
}` },
  { label: "DENY", color: "denial", body: `{
  "decision": "DENY",
  "authorizationId": "auth_90411",
  "reasonCodes": [
    "VENDOR_NOT_ALLOWED"
  ]
}` },
  { label: "REQUIRE_APPROVAL", color: "review", body: `{
  "decision": "REQUIRE_APPROVAL",
  "authorizationId": "auth_58201",
  "approvalId": "apr_72f83",
  "reasonCodes": [
    "APPROVAL_THRESHOLD_EXCEEDED"
  ]
}` }
] as const;

export default function DevelopersPage() {
  return (
    <main>
      <section className="page-hero overflow-hidden border-b border-line">
        <div className="authority-field pointer-events-none absolute inset-0 opacity-50" />
        <div className="site-container relative grid gap-14 py-16 sm:py-24 lg:grid-cols-[.85fr_1.15fr] lg:items-center lg:py-28">
          <div>
            <Eyebrow tone="authority">Developers / typed authority</Eyebrow>
            <h1 className="display-title mt-7 text-balance text-5xl font-semibold leading-[.95] tracking-[-.065em] sm:text-7xl">One call before the agent acts.</h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-muted">Authenticate the agent once, describe the exact requested action and let CAPYN return the only three outcomes your integration needs.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/start" className="public-primary-button min-h-12 justify-center px-6">Generate your integration <ArrowRight size={15} /></Link>
              <a href="#quickstart" className="public-secondary-button min-h-12 justify-center px-6">Run the local demo</a>
            </div>
            <a href={repositoryUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-xs font-extrabold text-muted hover:text-ink"><Github size={14} /> Inspect the MIT-licensed source <ArrowRight size={13} /></a>
          </div>
          <CodeWindow label="agent.ts" code={sdkExample} />
        </div>
      </section>

      <section id="quickstart" className="site-section bg-code text-white">
        <div className="site-container grid gap-12 lg:grid-cols-[.7fr_1.3fr] lg:items-start">
          <div>
            <Eyebrow tone="permission">Twenty-second quick start</Eyebrow>
            <h2 className="display-title mt-6 text-4xl font-semibold tracking-[-.055em] sm:text-5xl">See the policy engine decide.</h2>
            <p className="mt-6 max-w-lg text-base leading-8 text-white/60">The demo runs in memory and exercises the real Fastify handlers, identity adapter and policy engine. No database service is required.</p>
            <div className="mt-8 flex flex-wrap gap-2">
              {["Node.js 22+", "Corepack", "pnpm 11"].map((item) => <span key={item} className="border border-white/15 px-3 py-2 font-mono text-[9px] text-white/60">{item}</span>)}
            </div>
            <p className="mt-5 max-w-md font-mono text-[9px] leading-5 text-white/40">V0.2 prepares independently installable SDK, policy-engine and types packages. Registry publication still awaits an owner-controlled @capyn npm scope.</p>
            <Link href="/docs/package-publishing" className="mt-4 inline-flex items-center gap-2 font-mono text-[9px] font-bold text-permission hover:text-white">Inspect the publication gate <ArrowRight size={12} /></Link>
          </div>
          <div>
            <CodeWindow label="terminal" code={quickStart} />
            <div className="mt-4 grid gap-px border border-white/15 bg-white/15 sm:grid-cols-2">
              {[["$18 → OpenAI", "ALLOW", "permission"], ["$30 → Unknown", "DENY", "denial"], ["$120 → AWS", "REQUIRE_APPROVAL", "review"], ["transfer.wallet", "DENY", "denial"]].map(([request, decision, tone]) => <div key={request} className="flex items-center justify-between bg-code px-4 py-4"><span className="font-mono text-[9px] text-white/55">{request}</span><span className={`font-mono text-[8px] ${tone === "permission" ? "text-permission" : tone === "review" ? "text-review" : "text-denial"}`}>{decision}</span></div>)}
            </div>
          </div>
        </div>
      </section>

      <section id="api" className="site-section border-b border-line">
        <div className="site-container grid gap-12 lg:grid-cols-[.75fr_1.25fr]">
          <div>
            <Eyebrow>REST API / v1</Eyebrow>
            <h2 className="display-title mt-6 text-4xl font-semibold tracking-[-.055em]">A small surface with explicit contracts.</h2>
            <p className="mt-6 text-base leading-8 text-muted">Agent identity always comes from the bearer key. `agentId` is not accepted in the authorization payload.</p>
            <div className="mt-8"><TextLink href="/security">Understand the trust boundary</TextLink></div>
          </div>
          <div className="border border-line bg-panel">
            {endpoints.map(([method, path, copy]) => (
              <div key={`${method}-${path}`} className="grid gap-3 border-b border-line/70 px-5 py-5 last:border-0 sm:grid-cols-[58px_1fr_1.2fr] sm:items-center sm:px-6">
                <span className={`w-fit border px-2 py-1 font-mono text-[8px] ${method === "GET" ? "border-authority/30 bg-authority/10 text-authority" : "border-permission/30 bg-permission/10 text-permission"}`}>{method}</span>
                <code className="break-all font-mono text-[10px] font-medium">{path}</code>
                <p className="text-xs leading-5 text-muted">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="site-section bg-panel">
        <div className="site-container">
          <SectionHeading eyebrow="Deterministic response" title="Branch on the decision. Log the evidence." copy="Reason codes are safe for machines, support tooling and audit views. Human-readable descriptions stay available without replacing the canonical code." />
          <div className="mt-12 grid gap-4 xl:grid-cols-3">
            {responses.map((response) => (
              <div key={response.label} className="overflow-hidden border border-line bg-code text-white">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><span className={`font-mono text-[9px] ${response.color === "permission" ? "text-permission" : response.color === "review" ? "text-review" : "text-denial"}`}>{response.label}</span><Braces size={14} className="text-white/35" /></div>
                <pre className="overflow-x-auto p-5 font-mono text-[10px] leading-5 text-white/65"><code>{response.body}</code></pre>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="site-section border-y border-line">
        <div className="site-container grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[{ icon: KeyRound, title: "Agent credentials", copy: "256-bit generated keys, hashed at rest, revocable and bound to one agent." }, { icon: Clock3, title: "Idempotent requests", copy: "The same key and payload returns the same logical authorization result." }, { icon: LockKeyhole, title: "Exact approvals", copy: "Approval pauses one authorization and is consumed by that request alone." }, { icon: Play, title: "One-time execution", copy: "A unique execution claim prevents the provider adapter from being invoked twice." }].map(({ icon: Icon, title, copy }) => <article key={title} className="p-2"><Icon size={18} className="text-authority" /><h2 className="mt-7 text-sm font-extrabold">{title}</h2><p className="mt-3 text-xs leading-6 text-muted">{copy}</p></article>)}
        </div>
      </section>

      <section className="site-section">
        <div className="site-container grid gap-12 lg:grid-cols-[.7fr_1.3fr] lg:items-center">
          <div><TerminalSquare size={22} className="text-authority" /><h2 className="display-title mt-8 text-4xl font-semibold tracking-[-.055em]">Prefer raw HTTP?</h2><p className="mt-5 text-sm leading-7 text-muted">The SDK is a thin typed client over the same REST contract. Use curl, another language or your existing agent runtime.</p></div>
          <CodeWindow label="authorize.sh" code={curlExample} />
        </div>
      </section>

      <PublicCta />
    </main>
  );
}
