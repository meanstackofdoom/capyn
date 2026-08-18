# Deployment

CAPYN is platform-neutral. The current codebase is suitable for a hosted developer demo or public alpha; it is not yet approved for custody or real-money settlement.

## Service shape

Deploy the web, control API and Gate as separate services with separate secret
scopes:

```text
Browser ──► web service ──► API service ──► authority PostgreSQL
Agent ────────────────────► API service
                                │ signed exact-action claim
                                ▼
                           Gate service ──► replay PostgreSQL
                                │
                                └─► provider adapter
```

The web service has no direct database access. The API is the only application
component intended to mutate authority state. Gate code writes only replay
consumption state and is the only component that may eventually receive a
provider credential. Enforce that distinction with a separate database or
least-privilege Gate role; a shared full-access `DATABASE_URL` would not provide
database-level isolation. The API receives the private claim signer; the Gate
receives only public verification keys.

When a public-alpha account is limited to one application service, `CAPYN_SERVICE=combined` starts the same built web and API processes on private loopback ports and exposes them through a small first-party HTTP proxy. The API can use an atomic journal on the service's attached persistent volume, and the domain and application boundaries remain separate in code. Higher-scale or dedicated customer environments should use the preferred separate-service shape above.

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

## Gate service

Build and start the separately deployable boundary:

```bash
corepack pnpm --filter @capyn/gate-service... build
corepack pnpm --filter @capyn/gate-service start
```

For the root launcher, set `CAPYN_SERVICE=gate`; it applies checked-in migrations
when `GATE_REPLAY_STORAGE=postgres`. Use `/healthz` for liveness and `/ready`
for the replay-database dependency check.

Configure the complete remote-Gate variable sets on both API and Gate exactly
as documented in [Configuration](configuration.md). Use independent service
secret scopes, private networking or TLS, and a high-entropy shared control
token. The API must not receive provider credentials; the Gate must not receive
the claim private key.

The shipped `aws-ec2-dry-run` adapter is safe for boundary demonstrations: it
validates a fixed capped blueprint and returns an explicit dry-run reference,
but does not load AWS credentials or call AWS. Do not interpret readiness or an
`aws_dry_run_*` result as AWS provisioning evidence.

## Railway deployment

Create independent web, API and—when exercising the remote boundary—Gate
services from the same repository. Configure each service with the commands
above, let Railway assign each service's `PORT`, and set:

- web: `CAPYN_SERVICE=web`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL`;
- API: `CAPYN_SERVICE=api`, `CAPYN_STORAGE=postgres`, `DATABASE_URL`, `API_KEY_PEPPER`, `WEB_ORIGIN`, `TRUST_PROXY=true` behind Railway ingress, and `DEMO_HUMAN_AUTH=false` for any non-demo environment;
- API bootstrap: omit `BOOTSTRAP_TOKEN` unless a controlled onboarding operation requires it.
- optional billing: set all four Stripe variables from [Configuration](configuration.md), then deliver subscribed events to `/v1/billing/webhooks/stripe`.
- remote Gate: set `CAPYN_SERVICE=gate`, PostgreSQL replay storage, public
  verification keys, exact issuer/audience, control token and fixed blueprint
  configuration; set the matching remote execution variables on the API.

Provision PostgreSQL as a managed service and restrict connectivity to the API service. No container-specific configuration is required by CAPYN.

For a one-service hosted alpha when the account cannot provision PostgreSQL, set `CAPYN_SERVICE=combined`, `CAPYN_STORAGE=volume`, and `CAPYN_VOLUME_PATH` to a dedicated subdirectory on the attached volume. Make `WEB_ORIGIN`, `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_API_URL` the same HTTPS public origin. The volume adapter initializes the fixed demonstration, so enable demo auth, pin `DEMO_HUMAN_USER_ID` to its least-privilege approver, and disable demo management controls in the web build. Durable workspaces authenticate separately with owner keys. Never run more than one API process against this journal.

The checked-in `railway.json` explicitly selects Railway's native Railpack
builder, builds the API, web and Gate dependency graphs, starts the root service
launcher and checks `/healthz`. The current combined web/API process exposes
that path; a split API service should select `/health`, while Gate uses
`/healthz`. CAPYN contains no Dockerfile.

### Current public-alpha instance

The public alpha is live at [capyn-production.up.railway.app](https://capyn-production.up.railway.app). Railway rejected another managed database at the account's current resource ceiling, so the combined service checkpoints to `/data/capyn/` on its existing attached volume. It does not read or alter the prior workload's other volume paths. The fixed Acme demonstration remains pinned to a least-privilege approver with hidden administration controls, while newly commissioned workspaces receive independent owner and agent credentials and durable tenant-scoped records. `MockPaymentExecutor` remains mandatory: the service must not receive real provider credentials or settlement instructions.

Railway's original resource ceiling required a recoverable source swap onto an existing stopped service. The prior volume contents remain preserved; CAPYN owns only its new `/data/capyn/` subdirectory. The prior custom domain was detached after the CAPYN hostname became healthy, so it no longer routes to CAPYN and can be reconfigured when the prior workload returns. The intended higher-scale topology remains separate web/API services with managed PostgreSQL.

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
9. when billing is enabled, complete a test-mode Checkout, replay its webhook and confirm one subscription audit event;
10. for a remote Gate rehearsal, verify `/ready`, one successful dry-run receipt, replay rejection and an ambiguous-transport reconciliation test.

Before real money, every item in the [Security production gate](security.md#production-gate) is mandatory. Hosting the current MVP does not satisfy that gate.

## Rollout and rollback

- the public-alpha root launcher applies checked-in, idempotent migrations before a PostgreSQL API process starts; move this to an explicit release job before operating multiple API replicas;
- keep schema changes backward compatible while old and new processes overlap;
- deploy API before web when the web needs a new API contract;
- deploy Gate public verification keys before switching the API to a new signing key, preserve overlap through the maximum claim window, then retire the old key;
- retain the previous build for immediate rollback;
- do not roll back a migration destructively without a reviewed data-recovery plan;
- record deployment identity and version in operational audit/observability systems.

The executor contract now requires `execute()` and read-only `reconcile()` using the same CAPYN execution ID. Leased request-driven recovery prevents an ambiguous response from automatically becoming a duplicate payment, but the mock executor has no external settlement state against which to validate that contract. A real rollout still requires a transactional outbox/worker, automatic stale-lease scanning, provider-specific alerts and reconciliation runbooks.

Every provider operation crosses the request-bound protocol documented in
[Execution Gate](execution-gate.md). The codebase now includes an authenticated
remote Gate, durable PostgreSQL replay adapter and persistent PEM
configuration. A real-money rollout still must place the Gate at the exclusive
provider-credential boundary, replace application-loaded private PEM with a
reviewed KMS/HSM signer, add provider-native execution/reconciliation evidence,
and remove equivalent authority from both agent and API.
