# Deployment

CAPYN is platform-neutral. The current codebase is suitable for a hosted developer demo or public alpha; it is not yet approved for custody or real-money settlement.

## Service shape

Deploy the web and API as separate services with separate environment scopes:

```text
Browser ──► web service ──► API service ──► PostgreSQL
Agent ────────────────────► API service ──► MockPaymentExecutor
```

The web service has no direct database access. The API is the only application component allowed to mutate authority state.

When a public-alpha account is limited to one application service, `CAPYN_SERVICE=combined` starts the same built web and API processes on private loopback ports and exposes them through a small first-party HTTP proxy. This is a deployment adapter for the synthetic, memory-backed demo only; the domain and application boundaries remain separate in code. Durable or customer-data environments should use the preferred separate-service shape above.

## Web service

Build from the monorepo root:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @capyn/web... build
```

Start:

```bash
corepack pnpm --filter @capyn/web start
```

The command binds to `0.0.0.0` and respects the platform-provided `PORT`. Set `CAPYN_SERVICE=web`, `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_API_URL` before the build. Use `/healthz` as the health endpoint.

## API service

Build:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @capyn/api... build
```

Apply checked-in migrations before starting a PostgreSQL-backed release:

```bash
corepack pnpm db:migrate
```

Start directly:

```bash
corepack pnpm --filter @capyn/api start
```

For a shared monorepo deployment, set `CAPYN_SERVICE=api` and run `corepack pnpm start`. The root launcher applies checked-in migrations when `CAPYN_STORAGE=postgres`, then starts the API. The web service uses the same root command with `CAPYN_SERVICE=web`. A constrained demo can use `CAPYN_SERVICE=combined`; `CAPYN_INTERNAL_API_PORT` and `CAPYN_INTERNAL_WEB_PORT` default to `4100` and `3100` and must differ from the platform `PORT`.

Use `/health` as the process health endpoint. A production-ready health strategy should add a separate readiness check that verifies the database and required executor dependencies without disclosing internal details.

## Railway deployment

Create independent web and API services from the same repository. Configure each service with the commands above, let Railway assign each service's `PORT`, and set:

- web: `CAPYN_SERVICE=web`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL`;
- API: `CAPYN_SERVICE=api`, `CAPYN_STORAGE=postgres`, `DATABASE_URL`, `API_KEY_PEPPER`, `WEB_ORIGIN`, `TRUST_PROXY=true` behind Railway ingress, and `DEMO_HUMAN_AUTH=false` for any non-demo environment;
- API bootstrap: omit `BOOTSTRAP_TOKEN` unless a controlled onboarding operation requires it.
- optional billing: set all four Stripe variables from [Configuration](configuration.md), then deliver subscribed events to `/v1/billing/webhooks/stripe`.

Provision PostgreSQL as a managed service and restrict connectivity to the API service. No container-specific configuration is required by CAPYN.

For a one-service synthetic demo, set `CAPYN_SERVICE=combined`, `CAPYN_STORAGE=memory`, `DEMO_HUMAN_AUTH=true`, pin `DEMO_HUMAN_USER_ID` to a least-privilege seeded approver, and make `WEB_ORIGIN`, `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_API_URL` the same HTTPS public origin. Set the matching browser-visible demo identity and disable management controls. Do not configure Stripe or real customer data in this topology. Verify it locally with `corepack pnpm smoke:combined` after the normal build.

The checked-in `railway.json` explicitly selects Railway's native Railpack builder, builds only the API/web dependency graphs, starts the root service launcher and checks `/healthz`. This prevents an older service-level Dockerfile setting from surviving a source swap; CAPYN contains no Dockerfile.

### Current public-alpha instance

The synthetic public alpha is live at [judgecat-production.up.railway.app](https://judgecat-production.up.railway.app). It runs `CAPYN_SERVICE=combined`, `CAPYN_STORAGE=memory`, a human adapter pinned to the seeded approver, hidden organisation-administration controls and `MockPaymentExecutor`. Deployments reset its state, and it must not receive customer data, real provider credentials or real settlement instructions.

Railway's free-plan resource ceiling required a recoverable source swap onto an existing stopped service. The prior volume and domain records were preserved and CAPYN does not read the mounted volume. The intended customer-data topology remains separate web/API services with managed PostgreSQL.

## Pre-deployment checklist

For a public demo:

1. run `corepack pnpm check`;
2. run `corepack pnpm docs:check`;
3. run `corepack pnpm audit --prod`;
4. build with final public origins and run `corepack pnpm smoke:production`;
5. confirm no `.env`, real credentials or customer data is committed;
6. set the canonical web and API origins;
7. verify `/healthz`, `/health`, `/`, `/docs`, `/dashboard` and one authorization request;
8. confirm the interface states clearly that execution is simulated;
9. when billing is enabled, complete a test-mode Checkout, replay its webhook and confirm one subscription audit event.

Before real money, every item in the [Security production gate](security.md#production-gate) is mandatory. Hosting the current MVP does not satisfy that gate.

## Rollout and rollback

- the public-alpha root launcher applies checked-in, idempotent migrations before a PostgreSQL API process starts; move this to an explicit release job before operating multiple API replicas;
- keep schema changes backward compatible while old and new processes overlap;
- deploy API before web when the web needs a new API contract;
- retain the previous build for immediate rollback;
- do not roll back a migration destructively without a reviewed data-recovery plan;
- record deployment identity and version in operational audit/observability systems.

The current mock executor has no external settlement state to reconcile. A real executor requires an outbox, provider idempotency and reconciliation before rollout can be considered safe.
