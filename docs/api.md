# REST API

Local base URL: `http://localhost:4000`

Synthetic public-demo base URL: `https://capyn-production.up.railway.app`

Start with [Getting started](getting-started.md) for the database-free local flow and [Configuration](configuration.md) for environment variables.

Agent endpoints use `Authorization: Bearer <CAPYN_API_KEY>`. Durable workspace owners use `Authorization: Bearer <CAPYN_OWNER_KEY>`. The development-only public demonstration can instead use the `x-capyn-user-id` adapter; the hosted build pins that adapter to the approver identity, so knowing another seeded user ID does not grant its role.

The demo values are:

```text
agent key: capyn_demo_N7m2kQ4xR8vB3pL6sT9wY1cF5hJ0dG2a
owner user: usr_demo_owner
approver user: usr_demo_approver
```

These are intentionally public, fixed demonstration credentials. Use them only against disposable local state or the explicit synthetic public demo. Never reuse them for durable data, customer environments or real authority.

## Public Authority Lab

`POST /v1/lab/evaluate` and `POST /v1/lab/approvals/:id` power the public [Authority Lab](https://capyn-production.up.railway.app/lab). They require no credential because they can evaluate only CAPYN's fixed synthetic mandate. Inputs are strictly validated, both routes are IP-rate-limited, approvals expire after ten minutes, and each approval can be decided once.

Lab operations are isolated from the repository and billing ledger. They hold only short-lived in-memory approval state, never call a payment provider, never move funds, and return `mode: "SYNTHETIC"` with an explicit notice. The evidence digest demonstrates a canonical receipt shape; it is not a production signature or durable audit record.

## Sandbox commissioning

`POST /v1/sandbox/activate` accepts a workspace name, agent identity, bounded mandate and first exact action. It returns `201` with a one-time plaintext `capyn_sbx_…` credential that expires after 30 minutes. The activation route is limited to ten requests per minute per resolved client IP.

`POST /v1/sandbox/authorize` accepts a normal Lab-shaped action and requires the issued credential as `Authorization: Bearer <CAPYN_SANDBOX_KEY>`. It recovers identity and mandate server-side, runs the production policy engine and returns `200` for `ALLOW` or `DENY`, or `202` for `REQUIRE_APPROVAL`. It is limited to sixty requests per minute.

Both responses state `mode: "SYNTHETIC"` and `scope: "STATELESS_SANDBOX"`. They never create repository or billing records and never call a payment provider. See [Sandbox commissioning](sandbox-commissioning.md) for the complete credential and threat boundary.

## Durable workspace onboarding

`POST /v1/onboarding/launch` claims one valid sandbox credential into the configured durable hosted-alpha repository. The public single-service deployment uses its attached volume journal; scale-out deployments use PostgreSQL. The route requires the sandbox bearer credential, an `Idempotency-Key` and the strict onboarding body documented in [Durable onboarding](durable-onboarding.md). It is limited to three attempts per hour per resolved client IP.

The first call returns `201`; an exact retry returns `200` with `replayed: true` and the same deterministic one-time credentials. The transaction creates the organisation, owner, agent, active 30-day mandate, Developer subscription, credential digests, claim record and audit events together. A sandbox credential cannot claim a second workspace.

The response returns separate `capyn_owner_live_…` and `capyn_live_…` plaintext values. Only HMAC digests are stored. The owner key is accepted only by human management endpoints; the agent key is accepted only by the agent API. A bearer header that fails owner-key authentication never falls back to the public demo header.

Developer is active immediately. Team or Business intent can return a hosted Checkout URL only when Stripe is fully configured. The paid plan remains inactive until a signed webhook verifies the provider subscription. Every self-serve workspace continues to use mock execution.

## Agent endpoints

### `GET /v1/me`

Returns the authenticated agent. There is no agent-ID parameter.

### `GET /v1/mandate`

Returns the agent's current active mandate and spending policy, or `null`.

### `POST /v1/authorize`

Required headers:

```text
Authorization: Bearer capyn_...
Idempotency-Key: caller-generated-stable-key
Content-Type: application/json
```

Request:

```json
{
  "capability": "spend.compute",
  "amount": { "value": "42.00", "currency": "USD" },
  "vendor": { "id": "openai", "name": "OpenAI" },
  "metadata": { "purpose": "Purchase additional inference capacity" }
}
```

Allow response (`200`):

```json
{
  "decision": "ALLOW",
  "authorizationId": "auth_...",
  "reasonCodes": ["CAPABILITY_ALLOWED", "VENDOR_ALLOWED", "TRANSACTION_LIMIT_OK"],
  "reasons": [
    { "code": "CAPABILITY_ALLOWED", "description": "The mandate grants the requested capability." }
  ],
  "expiresAt": "2026-08-16T10:15:00.000Z"
}
```

Approval response (`202`) adds `approvalId`. Denials return `200` because a policy denial is a successful authorization decision, not a transport error.

### `GET /v1/authorizations/:id`

Returns the normalized request, lifecycle state, decision, reasons and complete trace. An agent may read only its own organisation-bound authorization.

### `POST /v1/authorizations/:id/execute`

Executes one unexpired `ALLOWED` or `APPROVED` authorization. The current alpha returns a simulated provider reference. A denied, rejected or expired authorization returns `409` or `410`.

CAPYN creates one execution ID before calling the provider and holds a short execution lease. If the provider response is lost or explicitly uncertain, the authorization remains `EXECUTING` and the API returns `409 EXECUTION_OUTCOME_UNKNOWN`; CAPYN does not translate ambiguity into failure or issue a replacement payment. A retry before the lease expires returns `409 EXECUTION_IN_PROGRESS`. After expiry, the same endpoint calls the owning executor's `reconcile()` method with the original execution ID. A known result is finalized once; an unresolved result remains reserved and returns `EXECUTION_OUTCOME_UNKNOWN` again.

Real executors must use `executionId` as their provider idempotency/reconciliation key. They must distinguish definitive failure from unknown outcome and implement read-only reconciliation. Request-driven recovery is implemented, while automatic background scanning, provider-specific alerts and a transactional outbox remain production follow-up work.

## Human management endpoints

Durable owners send `Authorization: Bearer capyn_owner_live_…`. Local/public demo requests use `x-capyn-user-id` only when the demo adapter is explicitly enabled and pinned by deployment configuration.

| Method | Path | Roles |
|---|---|---|
| `GET` | `/v1/dashboard` | all users |
| `GET` | `/v1/billing` | all users |
| `POST` | `/v1/billing/checkout` | owner, admin |
| `POST` | `/v1/billing/portal` | owner, admin |
| `POST` | `/v1/agents` | owner, admin |
| `PATCH` | `/v1/agents/:id/status` | owner, admin |
| `POST` | `/v1/agents/:id/credentials` | owner, admin |
| `POST` | `/v1/agents/:agentId/credentials/:credentialId/rotate` | owner, admin |
| `DELETE` | `/v1/agents/:agentId/credentials/:credentialId` | owner, admin |
| `POST` | `/v1/mandates` | owner, admin |
| `DELETE` | `/v1/agents/:agentId/mandate` | owner, admin |
| `POST` | `/v1/approvals/:id/decision` | owner, admin, approver |

Normal agent/API-key creation responses contain plaintext once. CAPYN never persists or later recovers that random plaintext.

Credential rotation requires an `Idempotency-Key` header. In one agent-locked transaction CAPYN creates the replacement, revokes the exact source credential and appends `API_KEY_ROTATED`. A replay with the same key and source returns the same logical replacement, while reuse for another source returns `409 IDEMPOTENCY_CONFLICT`. The replay-safe replacement is deterministically derived from the high-entropy deployment pepper and its random credential ID, then only its HMAC hash is stored.

```bash
curl -X POST "$CAPYN_API_URL/v1/agents/$AGENT_ID/credentials/$CREDENTIAL_ID/rotate" \
  -H "x-capyn-user-id: $CAPYN_USER_ID" \
  -H "Idempotency-Key: rotation-2026-08-17-0001"
```

Copy the returned key before leaving the response. The previous key stops authenticating immediately. If transport fails before the response is received, retry the exact request with the same idempotency key to recover the same result.

`GET /v1/billing` returns the authenticated user's organisation plan, billing period, live metric lines and projected monthly amount. The client cannot submit another organisation ID.

Checkout accepts only `{ "planId": "TEAM" }` or `{ "planId": "BUSINESS" }` and requires an `Idempotency-Key` header using the same 8–200 character format as authorization. The key is organisation- and plan-bound before it reaches Stripe. Checkout returns a hosted provider URL when Stripe is fully configured, otherwise `503 BILLING_UNAVAILABLE`. Provider callbacks use unauthenticated `POST /v1/billing/webhooks/stripe`; authenticity comes from the required Stripe signature over the raw body, not a user session. See [Billing](billing.md).

Approval body:

```json
{
  "decision": "APPROVE",
  "comment": "Expected temporary compute scale-up"
}
```

## Organisation bootstrap

`POST /v1/organisations` requires `x-capyn-bootstrap-token`. Disable this route operationally by omitting `BOOTSTRAP_TOKEN` after onboarding, or replace it with a platform onboarding identity flow.

## Errors

```json
{
  "error": {
    "code": "IDEMPOTENCY_CONFLICT",
    "message": "This Idempotency-Key was already used with a different request payload",
    "requestId": "req-..."
  }
}
```

Validation errors may include safe `{ path, message }` details. Internal exceptions are logged with a request ID and returned as `INTERNAL_ERROR` without a stack.

Exhausting a hard Developer allowance returns HTTP `402` with `PLAN_LIMIT_REACHED`. An idempotent replay of an already recorded authorization still returns its original result without another usage event.

## Health

`GET /health` returns the API process status and version without authentication. It is a liveness endpoint, not proof that PostgreSQL or an external executor is ready. The web service exposes `GET /healthz` separately.
