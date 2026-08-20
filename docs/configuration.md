# Configuration

CAPYN uses environment variables at the API and web process boundaries. `.env.example` is safe to copy for local development; `.env` files are ignored and must not be committed.

## API variables

| Variable | Local default | Required | Purpose |
|---|---|---|---|
| `NODE_ENV` | `development` | No | Selects development, test or production behavior. |
| `HOST` | `0.0.0.0` | No | API listen address. |
| `PORT` | `4000` | No | API listen port. Hosting platforms may supply it. |
| `TRUST_PROXY` | `false` | Reverse-proxy deployments | Trusts the controlled ingress proxy's forwarded client address for per-client rate limiting. |
| `CAPYN_STORAGE` | `memory` in `.env.example` | No | Selects `memory`, `volume` or `postgres`. |
| `DATABASE_URL` | Local example only | PostgreSQL mode | Prisma connection URL. |
| `CAPYN_VOLUME_PATH` | unset | Volume mode | Absolute path to the single-service atomic state journal, normally on an attached persistent volume. |
| `API_KEY_PEPPER` | No safe deployment default | Yes | High-entropy secret used for domain-separated HMACs over durable owner/agent credentials and public-sandbox encryption. |
| `CAPYN_SEED_DEMO` | unset | No | When `true`, the root PostgreSQL launcher idempotently refreshes the isolated Acme demonstration tenant after migrations. |
| `WEB_ORIGIN` | `http://localhost:3010` | No | Exact browser origin allowed by API CORS. |
| `DEMO_HUMAN_AUTH` | `true` locally | No | Enables the development-only `x-capyn-user-id` adapter. Must be `false` outside a demo. |
| `DEMO_HUMAN_USER_ID` | `usr_demo_owner` locally | Production demo | Pins the demo header adapter to exactly one seeded user. Required when demo auth is enabled with `NODE_ENV=production`. |
| `BOOTSTRAP_TOKEN` | Local placeholder | No | Enables organisation bootstrap when present. Omit after controlled onboarding. |
| `CAPYN_EXECUTION_MODE` | `local-mock` | No | Selects the ephemeral in-process mock or the configured remote Gate. |
| `CAPYN_EXECUTION_GATE_URL` | unset | Remote Gate | Base URL for the separately deployed Gate. |
| `CAPYN_EXECUTION_GATE_CONTROL_TOKEN` | unset | Remote Gate | High-entropy workload credential sent only from the API to the Gate. |
| `CAPYN_EXECUTION_GATE_ID` | unset | Remote Gate | Exact Gate identity expected in every returned receipt. |
| `CAPYN_EXECUTION_PROVIDER_NAME` | unset | Remote Gate | Exact provider identity expected in execution records and Gate receipts. The shipped value is `aws-ec2-dry-run`. |
| `CAPYN_EXECUTION_ISSUER` | unset | Remote Gate | Stable execution-claim issuer. Must match the Gate verifier. |
| `CAPYN_EXECUTION_AUDIENCE` | unset | Remote Gate | Exact Gate audience. Must match the Gate verifier. |
| `CAPYN_EXECUTION_KEY_ID` | unset | Remote Gate | Active P-256 signing-key ID. |
| `CAPYN_EXECUTION_PRIVATE_KEY_B64` | unset | Remote Gate | Base64 PKCS#8 P-256 private PEM. Keep only in the control-plane secret scope. |
| `CAPYN_EXECUTION_GATE_RECEIPT_VERIFY_SECRET_B64` | unset | Remote Gate | Optional base64 secret that verifies the Gate receipt signature returned from Gate. |
| `CAPYN_EXECUTION_CLAIM_TTL_SECONDS` | `30` | No | Claim lifetime, bounded to 1–300 seconds. The Gate may enforce a smaller maximum. |
| `CAPYN_EXECUTION_GATE_TIMEOUT_MS` | `10000` | No | HTTP deadline. A timeout is recorded as an unknown outcome, never a safe failure. |
| `CAPYN_EXECUTION_SWEEP_ENABLED` | `false` | No | Enables the background stale-execution sweep. It issues `RECONCILE` claims only for pending executions whose lease expired; it never re-issues `EXECUTE`. |
| `CAPYN_EXECUTION_SWEEP_INTERVAL_MS` | `60000` | No | Sweep cadence, bounded to 5,000–3,600,000 milliseconds. Each pass processes at most 50 stale executions. |
| `STRIPE_SECRET_KEY` | unset | Hosted billing | Server-side Stripe key. Never expose it to the web bundle. |
| `STRIPE_WEBHOOK_SECRET` | unset | Hosted billing | Verifies the exact raw body delivered by Stripe. |
| `STRIPE_PRICE_TEAM_MONTHLY` | unset | Hosted billing | Stripe recurring base-price ID for Team. |
| `STRIPE_PRICE_BUSINESS_MONTHLY` | unset | Hosted billing | Stripe recurring base-price ID for Business. |

The API refuses to start in PostgreSQL mode without `DATABASE_URL`, in volume mode without `CAPYN_VOLUME_PATH`, with an `API_KEY_PEPPER` shorter than 32 characters, when production demo auth is not pinned to one user, or when only part of the Stripe or remote-Gate configuration is present. Remote variables are rejected unless `CAPYN_EXECUTION_MODE=remote-gate`; otherwise the safe local mock remains selected.

## Gate service variables

Run `apps/gate` as a separate service with `CAPYN_SERVICE=gate`. It has no
browser routes and should not share the API's private signing-key secret.

| Variable | Default | Required | Purpose |
|---|---|---|---|
| `HOST` | `0.0.0.0` | No | Gate listen address. |
| `PORT` | `4100` | No | Gate listen port. |
| `DATABASE_URL` | unset | PostgreSQL replay mode | Database containing `execution_claim_consumptions`. Prefer a separately scoped Gate database or a role restricted to that table. |
| `GATE_REPLAY_STORAGE` | `postgres` | Production | Selects durable PostgreSQL or local/test memory. Production refuses memory. |
| `GATE_CONTROL_TOKEN` | none | Yes | Workload bearer secret matching the API's control token. |
| `GATE_ID` | none | Yes | Stable identity included in Gate receipts. |
| `GATE_EXPECTED_ISSUER` | none | Yes | Exact accepted claim issuer. |
| `GATE_AUDIENCE` | none | Yes | Exact accepted audience. |
| `GATE_PUBLIC_KEYS_B64` | none | Yes | Base64 JSON object from key ID to P-256 SPKI public PEM. The Gate never needs the control private key. |
| `GATE_RECEIPT_SIGNING_SECRET_B64` | none | No | Base64 secret used to sign execution receipts before sending them to API. |
| `GATE_ALLOWED_CLOCK_SKEW_SECONDS` | `5` | No | Accepted clock skew, bounded to 0–60 seconds. |
| `GATE_MAX_CLAIM_TTL_SECONDS` | `60` | No | Maximum accepted claim lifetime, bounded to 1–300 seconds. |
| `AWS_SANDBOX_BLUEPRINTS_B64` | none | Yes | Base64 JSON array of fixed EC2 dry-run blueprints. No AWS credential or live-call switch exists in the shipped adapter. |

One blueprint has this strict shape:

```json
{
  "id": "capyn-t3-micro-v1",
  "region": "ap-southeast-2",
  "instanceType": "t3.micro",
  "imageFamily": "al2023",
  "instanceCount": 1,
  "maxMonthlyCostMinor": "12000"
}
```

Use `/healthz` for liveness and `/ready` for the replay-database readiness
check. The control channel still requires private networking or TLS; the bearer
secret alone does not provide transport confidentiality.

## Web variables

| Variable | Local default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Browser-visible API origin used by the control plane. |
| `NEXT_PUBLIC_DEMO_USER_ID` | `usr_demo_owner` | Development user sent only when demo human auth is intentionally enabled. |
| `NEXT_PUBLIC_DEMO_USER_NAME` | `Acme Owner` | Synthetic identity label displayed in the control plane. |
| `NEXT_PUBLIC_DEMO_USER_ROLE` | `Owner` | Synthetic identity role label displayed in the control plane. |
| `NEXT_PUBLIC_DEMO_MANAGEMENT_ENABLED` | `true` | Hides administrative controls when `false`; server-side role checks remain the security boundary. |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3010` | Canonical origin for metadata, sitemap and social cards. |
| `CAPYN_CONTACT_EMAIL` | unset | Optional owner-approved public address used to open a prefilled private boundary brief in the visitor's mail client. The draft is never posted to CAPYN. |
| `PROJECT_STATUS_PASSWORD` | unset | Server-only credential for the private project-status record. The route stays unavailable when omitted. |
| `PROJECT_STATUS_SESSION_SECRET` | unset | High-entropy server-only key used to sign the private project-status session cookie. |
| `PROJECT_STATUS_CONTENT_B64` | unset | Base64-encoded private Markdown stored in the deployment secret manager, never in the public repository or browser bundle. |
| `PORT` | platform supplied in production | Next.js listen port for `pnpm --filter @capyn/web start`. Development stays on `3010`. |
| `CAPYN_SERVICE` | unset locally | Set to `web`, `api` or `gate` for split deployment, or `combined` for the constrained web/API public alpha. |
| `CAPYN_INTERNAL_API_PORT` | `4100` | Private API port used only by the combined demo launcher. |
| `CAPYN_INTERNAL_WEB_PORT` | `3100` | Private Next.js port used only by the combined demo launcher. |

`NEXT_PUBLIC_*` values are embedded into the browser bundle at build time. Changing them requires a new web build.

## Persistence modes

### Memory

Use `CAPYN_STORAGE=memory` for the demo, tests and local interface work. State resets when the API process stops. The seeded organisation, users, agent, credential and mandate are recreated on startup.

### PostgreSQL

Use `CAPYN_STORAGE=postgres` with a provisioned PostgreSQL instance for durable state:

```bash
corepack pnpm db:migrate
corepack pnpm db:seed
```

The seed creates only the fixed `acme-ai` synthetic demonstration tenant. A public-alpha deployment may run it idempotently with `CAPYN_SEED_DEMO=true` when that tenant is intentionally exposed and the header adapter is pinned to its approver. Do not enable it in a dedicated customer deployment.

### Single-service volume journal

Use `CAPYN_STORAGE=volume` only for one API process with an attached persistent volume:

```text
CAPYN_STORAGE=volume
CAPYN_VOLUME_PATH=/data/capyn/capyn-state.v8
```

The adapter initializes the isolated demo tenant once, serializes all transactions through one process-wide mutex, writes a versioned V8 state envelope to a same-directory temporary file and atomically renames it over the previous checkpoint before acknowledging the transaction. An unreadable or unsupported state file fails startup instead of silently replacing data. It is a recoverable hosted-alpha fallback, not a multi-replica database: use PostgreSQL before horizontal scale, database-level row isolation, point-in-time recovery or production service guarantees.

## Secret handling

- generate `API_KEY_PEPPER` and `BOOTSTRAP_TOKEN` with a cryptographically secure secret manager;
- keep the execution private key only in the control-plane secret scope and Gate public keys only in the Gate scope;
- rotate claim keys with an overlap in `GATE_PUBLIC_KEYS_B64`, then remove the old verifier only after its maximum claim/reconciliation window;
- transport `CAPYN_EXECUTION_GATE_CONTROL_TOKEN` only over authenticated private networking or TLS and rotate both service copies together;
- rotate `API_KEY_PEPPER` only as a coordinated credential event: it invalidates durable key lookups and every unexpired stateless sandbox credential;
- scope secrets per environment;
- never expose the pepper, database URL or bootstrap token through `NEXT_PUBLIC_*` variables;
- rotate agent credentials through CAPYN rather than editing hashes;
- redact authorization and bootstrap headers from every log sink;
- redact Stripe signatures and never log Checkout payloads or billing secrets;
- keep the project-status password, content and session secret server-side, rotate credentials together, and never prefix them with `NEXT_PUBLIC_`;
- keep `TRUST_PROXY=false` unless the API is behind a controlled ingress proxy; Railway API services should set it to `true`;
- keep the demo header adapter pinned to the isolated synthetic tenant when it shares a public-alpha deployment with durable owner-key workspaces; disable it entirely in dedicated customer deployments.

See [Billing](billing.md) for plan and webhook behavior, [Security](security.md) for the deployment gate and [Deployment](deployment.md) for service-level configuration.
