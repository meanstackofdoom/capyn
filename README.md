# CAPYN

**Authority infrastructure for autonomous agents.**

[![CI](https://github.com/meanstackofdoom/capyn/actions/workflows/ci.yml/badge.svg)](https://github.com/meanstackofdoom/capyn/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-4ac39c.svg)](LICENSE)

[Commission an agent, prove its first decision and claim a durable workspace](https://capyn-production.up.railway.app/activate), or inspect the [v0.4.0 release](https://github.com/meanstackofdoom/capyn/releases/tag/v0.4.0).

The hosted alpha now persists tenant-scoped identities, mandates, credential digests, subscriptions and audit evidence in an atomic journal on its attached Railway volume. The PostgreSQL schema and migrations remain the scale-out target. Execution remains mock: it does not custody or move real money and it must not receive real provider credentials or settlement instructions.

CAPYN allows organisations to delegate constrained financial authority to AI agents using capabilities, spending limits, vendor policies, approvals and complete audit trails.

Give agents authority.

Not unlimited access.

```text
procurement-agent
      │
      ▼
POST /v1/authorize
      │
      ▼
CAPYN POLICY ENGINE
      │
      ├── ALLOW
      ├── DENY
      └── REQUIRE_APPROVAL
```

CAPYN is not a wallet, token, DAO or payment rail. It is the decision point before consequential execution. The executor still simulates payment, but every provider operation now crosses a short-lived ES256 claim bound to the exact stored action and a one-use Gate before the mock adapter can run. Future adapters can settle through Solana/USDC, x402, Stripe, AP2 or another rail without moving policy enforcement into the adapter.

## See it in 24 seconds

[![Watch the CAPYN public-alpha authorization demo](outreach/video/capyn-public-alpha-cover.png)](outreach/video/capyn-public-alpha.mp4)

The [public-alpha video](outreach/video/capyn-public-alpha.mp4) is generated from the checked-in [Remotion source](apps/video/src/video.tsx), so the launch asset can evolve with the product instead of becoming an unrepeatable screen recording.

Requirements: Node.js 22+ and Corepack.

```bash
git clone https://github.com/meanstackofdoom/capyn.git
cd capyn
corepack pnpm install
corepack pnpm demo
```

The demo runs entirely in memory and exercises the real Fastify handlers and policy engine:

```text
✓ $18.00 → OpenAI
  ALLOW

✗ $30.00 → UnknownVendor
  DENY
  VENDOR_NOT_ALLOWED

! $120.00 → AWS
  REQUIRE_APPROVAL
  APPROVAL_THRESHOLD_EXCEEDED

✗ transfer.wallet · $20.00
  DENY
  CAPABILITY_NOT_GRANTED
```

The seeded hard per-transaction ceiling is `$150`, not `$50`. A `$50` hard ceiling and a `$120` approval example are logically incompatible: human approval must not silently override a hard policy maximum. The approval threshold remains `$100`; the daily and monthly limits are `$200` and `$2,000`.

## Public website

The public surface is a complete, responsive Next.js site:

- `/` — positioning, authority rail and the core demo story
- `/activate` — sandbox commissioning through expiring credential, decision and portable proof, followed by an optional one-way claim into a durable workspace
- `/lab` — a public, ephemeral instrument backed by the real policy evaluator
- `/proof` — a client-side verifier for shareable synthetic decision receipts
- `/start` — the browser-local Mandate Studio for drafting an exact authority boundary
- `/passport` — a client-side verifier for shareable, digest-covered draft authority passports
- `/design-partners` — engagement model, fit and explicit public/private application routes
- `/design-partners/brief` — a browser-local boundary brief that is never uploaded by the page
- `/case-studies/procurement-agent` — an end-to-end procurement authority case study
- `/product` — lifecycle, policy model and execution boundary
- `/security` — implemented controls, concurrency and explicit limitations
- `/developers` — SDK, curl, REST surface and response contracts
- `/pricing` — open-source, hosted, design-partner and enterprise commercial model
- `/docs` — canonical repository documentation rendered as a public evidence register
- `/about` — the agent authority thesis and roadmap
- `/dashboard` — the working CAPYN control plane
- `/dashboard/billing` — plan allowances, live usage, projected fees and hosted checkout controls

The Mandate Studio can issue a versioned Authority Passport into a URL fragment. The browser validates its schema and recomputes its canonical SHA-256 digest locally; the fragment is not submitted with the HTTP request. A digest match proves bundle integrity only—it is not a signature, credential, activated mandate or execution record.

![CAPYN authorization evidence with a selected policy trace](outreach/screenshots/capyn-authorization-trace.png)

Run just the public website:

```bash
corepack pnpm install
corepack pnpm --filter @capyn/web dev
```

Open `http://localhost:3010`. The marketing pages do not need the API or any external service.

## Run the complete local product

The default environment uses the in-memory repository, so the API, seeded control plane and website run without a database service:

```powershell
corepack pnpm install
Copy-Item .env.example .env
corepack pnpm dev
```

Open:

- Website and dashboard: `http://localhost:3010`
- API: `http://localhost:4000`
- API health: `http://localhost:4000/health`
- Website health: `http://localhost:3010/healthz`

The fixed demo key is documented in [docs/api.md](docs/api.md). It is valid only for disposable local or explicitly published CAPYN demo environments and must never protect durable data or real authority. PostgreSQL and the single-service volume journal are separate repository adapters.

## Hosting handoff

The monorepo includes a platform-neutral root launcher for separate Railway-style web and API services. Set `CAPYN_SERVICE=web` or `CAPYN_SERVICE=api`, then run:

```bash
corepack pnpm build
corepack pnpm start
```

For a resource-constrained hosted alpha, `CAPYN_SERVICE=combined` runs those same built processes behind one first-party proxy and can checkpoint its repository to an attached volume. Run `corepack pnpm smoke:combined` to verify that adapter; no Docker configuration is used.

The current volume-backed public alpha is live at [capyn-production.up.railway.app](https://capyn-production.up.railway.app). Its Railway project, service and generated hostname all use the CAPYN name; a dedicated product domain and managed-PostgreSQL upgrade remain launch follow-ups.

The selected service binds to `0.0.0.0` and respects the platform `PORT`. Set `NEXT_PUBLIC_SITE_URL` to the final public origin and use `/healthz` for the web health check. The API uses `/health`. No Docker configuration is required.

After a production build, run the self-contained deployment smoke gate on unused ports `3110` and `4110`:

```bash
corepack pnpm smoke:production
```

It starts the built services temporarily, proves all four authority decisions plus approval/execution, checks every public documentation route and dashboard noindex boundary, verifies SEO/security headers, and releases both ports when complete.

## Central API

```bash
curl -X POST http://localhost:4000/v1/authorize \
  -H "Authorization: Bearer $CAPYN_API_KEY" \
  -H "Idempotency-Key: inference-order-0001" \
  -H "Content-Type: application/json" \
  -d '{
    "capability": "spend.compute",
    "amount": { "value": "18.42", "currency": "USD" },
    "vendor": { "id": "openai", "name": "OpenAI" },
    "metadata": { "purpose": "Purchase inference capacity" }
  }'
```

The authenticated agent comes only from the API key. `agentId` is not accepted in the payload.

Owner/admin credential operations include atomic, idempotent key rotation. The replacement is returned without storing plaintext, the exact source key is revoked in the same transaction, and a transport retry can recover the same response with its original `Idempotency-Key`.

## TypeScript SDK

```ts
import { Capyn } from "@capyn/sdk";

const capyn = new Capyn({ apiKey: process.env.CAPYN_API_KEY! });

const result = await capyn.authorize({
  capability: "spend.compute",
  amount: { value: "18.42", currency: "USD" },
  vendor: { id: "openai" },
  metadata: { purpose: "Purchase inference capacity" }
});

if (result.decision === "ALLOW") {
  // Execute the exact authorised action.
}
```

## Repository

```text
apps/
  api/                 Fastify REST API and domain services
  video/               Reproducible Remotion launch video
  web/                 Next.js public website and App Router control plane
packages/
  billing/             Hosted plan catalogue, entitlements and overage calculator
  gate/                Signed exact-action execution claims and replay boundary
  policy-engine/       Pure deterministic evaluator
  database/            Prisma/PostgreSQL and repository adapters
  sdk/                 Typed agent client
  types/               Shared schemas and contracts
docs/                  Architecture, security, API and roadmap
examples/              One-command demo and SDK example
outreach/techradar/    Launch outreach templates and proof checklist
outreach/video/        Rendered public-alpha video and cover
```

The important dependency direction is:

```text
identity → mandate → policy evaluation → authorization → approval → signed claim → Gate → execution → audit
```

The policy engine does not know how PostgreSQL or Solana works. The executor does not decide permission. The web app is not a security boundary.

## Commands

```bash
pnpm demo          # four launch scenarios, no database required
pnpm dev           # API + web development servers
pnpm docs:check    # validate the canonical documentation catalog and links
pnpm test          # policy, SDK, API and security tests
pnpm typecheck     # all workspaces and examples
pnpm lint          # strict workspace lint
pnpm build         # production builds
pnpm check         # complete verification sequence
pnpm video:render  # render the 24-second public-alpha video
pnpm video:still   # render its social/README cover
pnpm media:screenshot # capture a live selected authorization trace
pnpm db:migrate    # deploy PostgreSQL migrations
pnpm db:seed       # seed Acme AI and procurement-agent
```

## Security posture

- Fail closed for absent, ambiguous or malformed policy.
- HMAC-SHA-256 API-key hashes at rest with a deployment pepper.
- Separate owner and agent credentials with domain-separated derivation and one-time plaintext recovery.
- API keys are organisation-scoped, revocable and bound to one agent.
- Strict Zod request schemas reject extra identity fields.
- PostgreSQL serializable transactions and advisory locks protect scale-out spend accounting; the single-service volume adapter uses one process-wide transaction mutex and atomic file replacement.
- Organisation advisory locks protect hosted quotas across simultaneous agents.
- Approval rechecks every hard rule under the same lock and applies only to one authorization.
- Execution is claimed once with a unique database record after rechecking the agent and exact mandate binding.
- Each execute/reconcile attempt receives a short-lived ES256 claim bound to the exact request, Gate audience and leased attempt; the Gate consumes its claim ID once before invoking the provider.
- Non-mock executors refuse to attach without an explicitly configured authority and Gate.
- Ambiguous provider outcomes remain `EXECUTING`; a leased exact retry calls `reconcile()` with the original execution ID instead of issuing payment again.
- Audit events are append-only through the application and protected by a database trigger.
- Structured logs redact authorization and bootstrap headers.
- Stripe Checkout/portal remain server-side; Checkout and signed raw-body webhooks are both idempotent.

## Commercial model

The MIT-licensed policy engine and exact-action Gate/verifier remain free. The hosted Developer plan includes 3 active agents and 10,000 authorization decisions per month. Team is `$99/month`; Business is `$499/month`. Both are hosted-alpha authority workspaces with mock execution, while production engagements remain custom until their adapters and service boundary are explicitly contracted. Design-partner engagements begin at `$1,000/month` for 8–12 weeks of founder-led integration work.

CAPYN meters decisions, active agents, approval operations, audit evidence and integration connections. It never charges a percentage of money moved, and approvals carry no per-request fee. Stripe Checkout, customer portal and signed subscription webhooks are implemented when configured. Automated Stripe overage invoicing remains explicitly deferred; current overage values are durable, test-backed projections. See [Billing](docs/billing.md).

Read [docs/security.md](docs/security.md) before considering live execution. v0.4 adds durable owner-key authentication while retaining an isolated public-demo adapter and a mock executor; SSO/MFA and a reviewed real executor remain production gates.

## Documentation

- [Architecture](docs/architecture.md)
- [Getting started](docs/getting-started.md)
- [Configuration](docs/configuration.md)
- [Domain model](docs/domain-model.md)
- [Billing](docs/billing.md)
- [Website and brand system](docs/website.md)
- [Policy engine](docs/policy-engine.md)
- [Execution Gate](docs/execution-gate.md)
- [Package publishing](docs/package-publishing.md)
- [Security](docs/security.md)
- [REST API](docs/api.md)
- [Sandbox commissioning](docs/sandbox-commissioning.md)
- [Durable onboarding](docs/durable-onboarding.md)
- [Deployment](docs/deployment.md)
- [Documentation policy](docs/documentation.md)
- [Version 0.4 launch checklist](docs/launch-checklist.md)
- [Solana roadmap](docs/solana-roadmap.md)
- [The Agent Authority Problem](docs/agent-authority-problem.md)
- [Changelog](CHANGELOG.md)

## Status

CAPYN v0.4 is a public, open-source hosted alpha, tagged as [`v0.4.0`](https://github.com/meanstackofdoom/capyn/releases/tag/v0.4.0). It adds a one-way sandbox-to-durable-repository launch, separate owner and agent credentials, persistent tenant dashboards and self-serve plan intent without claiming live execution. Founder launch actions remain in a server-protected record outside the public repository. Deferred production work is explicit in [docs/security.md](docs/security.md) and [docs/solana-roadmap.md](docs/solana-roadmap.md).
