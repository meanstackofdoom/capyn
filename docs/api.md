# REST API

Base URL: `http://localhost:4000`

Start with [Getting started](getting-started.md) for the database-free local flow and [Configuration](configuration.md) for environment variables.

Agent endpoints use `Authorization: Bearer <CAPYN_API_KEY>`. Human management endpoints use the development-only `x-capyn-user-id` adapter in the seeded demo.

The demo values are:

```text
agent key: capyn_demo_N7m2kQ4xR8vB3pL6sT9wY1cF5hJ0dG2a
owner user: usr_demo_owner
approver user: usr_demo_approver
```

Never use these credentials outside local development.

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

Executes one unexpired `ALLOWED` or `APPROVED` authorization. v0.1 returns a simulated provider reference. A denied, rejected or expired authorization returns `409` or `410`.

## Human management endpoints

| Method | Path | Roles |
|---|---|---|
| `GET` | `/v1/dashboard` | all users |
| `POST` | `/v1/agents` | owner, admin |
| `PATCH` | `/v1/agents/:id/status` | owner, admin |
| `POST` | `/v1/agents/:id/credentials` | owner, admin |
| `DELETE` | `/v1/agents/:agentId/credentials/:credentialId` | owner, admin |
| `POST` | `/v1/mandates` | owner, admin |
| `DELETE` | `/v1/agents/:agentId/mandate` | owner, admin |
| `POST` | `/v1/approvals/:id/decision` | owner, admin, approver |

Agent/API-key creation responses contain plaintext once. CAPYN never returns it again.

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

## Health

`GET /health` returns the API process status and version without authentication. It is a liveness endpoint, not proof that PostgreSQL or an external executor is ready. The web service exposes `GET /healthz` separately.
