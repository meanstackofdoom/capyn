# Getting started

CAPYN can demonstrate its full authorization path locally without a database service or payment network. The default environment uses the in-memory repository and `MockPaymentExecutor`; it moves no real funds.

## Prerequisites

- Node.js 22 or newer;
- Corepack enabled;
- pnpm 11.8.0, selected from the repository `packageManager` field.

## Prove the policy engine first

Install dependencies and run the four launch scenarios:

```bash
corepack pnpm install
corepack pnpm demo
```

The command exercises the real Fastify handlers, agent-key authentication, policy engine, approval creation and audit repository in memory. Expected decisions:

| Request | Decision | Driving reason |
|---|---|---|
| `$18.00 → OpenAI` | `ALLOW` | Every hard rule passes |
| `$30.00 → UnknownVendor` | `DENY` | `VENDOR_NOT_ALLOWED` |
| `$120.00 → AWS` | `REQUIRE_APPROVAL` | `APPROVAL_THRESHOLD_EXCEEDED` |
| `transfer.wallet · $20.00` | `DENY` | `CAPABILITY_NOT_GRANTED` |

## Run the public website only

```bash
corepack pnpm --filter @capyn/web dev
```

Open `http://localhost:3010`. Public pages and documentation do not require the API. The control-plane dashboard does.

## Run the complete local product

Create the local environment file, then start every workspace in development mode:

```powershell
Copy-Item .env.example .env
corepack pnpm dev
```

Local endpoints:

| Surface | URL |
|---|---|
| Public website | `http://localhost:3010` |
| Sandbox commissioning | `http://localhost:3010/activate` |
| Documentation | `http://localhost:3010/docs` |
| Control plane | `http://localhost:3010/dashboard` |
| Web health | `http://localhost:3010/healthz` |
| REST API | `http://localhost:4000` |
| API health | `http://localhost:4000/health` |

The default `pnpm dev` intentionally starts only web and API, leaving execution
on the safe local mock. A remote Gate is an explicit second deployment. After
configuring its public keys, replay database, control token and fixed blueprint
from [Configuration](configuration.md), start it with:

```bash
corepack pnpm dev:gate
```

Gate liveness is `http://localhost:4100/healthz`; readiness is
`http://localhost:4100/ready`. The shipped provider performs no AWS network
call. The full control-to-Gate gauntlet is covered by the API and Gate service
test suites rather than enabled by the default local environment.

The seeded local user is `usr_demo_owner`. The seeded agent key is intentionally documented in [REST API](api.md); it is valid only for disposable local or explicitly published CAPYN demo environments and must never protect durable data or real authority.

The commissioning page requires both web and API services. It creates a stateless 30-minute sandbox credential, evaluates a first authenticated action and emits portable synthetic proof without modifying the seeded repository. After proof, the onboarding rail can create owner and agent credentials plus a workspace record. In the default memory configuration that final step is explicitly labelled a process-memory rehearsal and resets with the API; use the volume journal for a single process or PostgreSQL for a scale-out durable result. See [Sandbox commissioning](sandbox-commissioning.md) and [Durable onboarding](durable-onboarding.md).

## Make one authorization request

```bash
curl -X POST http://localhost:4000/v1/authorize \
  -H "Authorization: Bearer capyn_demo_N7m2kQ4xR8vB3pL6sT9wY1cF5hJ0dG2a" \
  -H "Idempotency-Key: getting-started-0001" \
  -H "Content-Type: application/json" \
  -d '{
    "capability": "spend.compute",
    "amount": { "value": "18.00", "currency": "USD" },
    "vendor": { "id": "openai", "name": "OpenAI" },
    "metadata": { "purpose": "Getting-started verification" }
  }'
```

The response decision should be `ALLOW`. Repeating the identical request with the same idempotency key returns the same logical authorization. Changing the payload while reusing that key returns `IDEMPOTENCY_CONFLICT`.

## Verify before changing authority logic

```bash
corepack pnpm check
corepack pnpm docs:check
corepack pnpm audit --prod
```

Read [Policy engine](policy-engine.md) before changing evaluation behavior and [Security](security.md) before changing identity, limits, approvals, execution or audit handling.
