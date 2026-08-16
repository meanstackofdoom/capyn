# Deployment

CAPYN is platform-neutral. The current codebase is suitable for a hosted developer demo or public alpha; it is not yet approved for custody or real-money settlement.

## Service shape

Deploy the web and API as separate services with separate environment scopes:

```text
Browser ──► web service ──► API service ──► PostgreSQL
Agent ────────────────────► API service ──► MockPaymentExecutor
```

The web service has no direct database access. The API is the only application component allowed to mutate authority state.

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

The command binds to `0.0.0.0` and respects the platform-provided `PORT`. Set `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_API_URL` before the build. Use `/healthz` as the health endpoint.

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

Start:

```bash
corepack pnpm --filter @capyn/api start
```

Use `/health` as the process health endpoint. A production-ready health strategy should add a separate readiness check that verifies the database and required executor dependencies without disclosing internal details.

## Railway handoff

For a later Railway deployment, create independent web and API services from the same repository. Configure each service with the commands above, let Railway assign each service's `PORT`, and set:

- web: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL`;
- API: `CAPYN_STORAGE=postgres`, `DATABASE_URL`, `API_KEY_PEPPER`, `WEB_ORIGIN`, `DEMO_HUMAN_AUTH=false`;
- API bootstrap: omit `BOOTSTRAP_TOKEN` unless a controlled onboarding operation requires it.

Provision PostgreSQL as a managed service and restrict connectivity to the API service. No container-specific configuration is required by CAPYN.

## Pre-deployment checklist

For a public demo:

1. run `corepack pnpm check`;
2. run `corepack pnpm docs:check`;
3. run `corepack pnpm audit --prod`;
4. confirm no `.env`, real credentials or customer data is committed;
5. set the canonical web and API origins;
6. verify `/healthz`, `/health`, `/`, `/docs`, `/dashboard` and one authorization request;
7. confirm the interface states clearly that execution is simulated.

Before real money, every item in the [Security production gate](security.md#production-gate) is mandatory. Hosting the current MVP does not satisfy that gate.

## Rollout and rollback

- run database migrations as an explicit release step, never on every API process start;
- keep schema changes backward compatible while old and new processes overlap;
- deploy API before web when the web needs a new API contract;
- retain the previous build for immediate rollback;
- do not roll back a migration destructively without a reviewed data-recovery plan;
- record deployment identity and version in operational audit/observability systems.

The current mock executor has no external settlement state to reconcile. A real executor requires an outbox, provider idempotency and reconciliation before rollout can be considered safe.
