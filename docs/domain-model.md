# Domain model

## Organisation

The tenant boundary. Every agent, mandate, authorization, approval, execution and audit event belongs to one organisation. Service methods check organisation ownership before returning a resource, including not-found responses for cross-tenant IDs.

## User

A human principal with one role:

- `OWNER`: full organisation authority;
- `ADMIN`: operational administration;
- `APPROVER`: approve or reject exact requests;
- `VIEWER`: read-only control-plane access.

The v0.1 `x-capyn-user-id` adapter is explicitly development-only. The `AuthAdapter` boundary is where Clerk, Auth0, Better Auth or an enterprise identity provider can be added.

## Agent and credential

An `Agent` is an autonomous software identity with status `ACTIVE`, `SUSPENDED` or `REVOKED`.

An `AgentCredential` belongs to exactly one agent. CAPYN generates 256 bits of random key material, returns plaintext once, and persists only:

- a display prefix;
- an HMAC-SHA-256 hash using `API_KEY_PEPPER`;
- creation, last-used and revocation timestamps.

Revoking an agent is terminal: it revokes active credentials, prevents replacement credentials and cannot be reversed through the management API. Suspending an agent preserves credentials but the policy engine returns `AGENT_INACTIVE`.

## Mandate

A mandate is a versioned, time-bounded grant to one agent. It contains namespaced capability strings and one spending policy. Creating a new active version revokes the previous active version inside the same transaction.

Mandate activation runs under the agent lock and revokes the previous active version in the same serializable transaction. The policy engine independently fails closed if an inconsistent store ever supplies more than one active mandate.

## Spending policy

v0.1 stores:

- currency (`USD` only);
- vendor IDs;
- hard per-transaction limit;
- UTC daily limit;
- calendar-month limit;
- approval threshold.

All amounts are signed database `BIGINT` values constrained to be positive where applicable. Public API amounts are decimal strings and are converted without JavaScript floating point.

## Authorization

An authorization is a request-specific policy decision. It retains the normalized action, request fingerprint, idempotency key, decision, lifecycle state, reason codes and full evaluation trace.

`(agentId, idempotencyKey)` is unique. The same canonical payload returns the existing logical result; another payload returns `IDEMPOTENCY_CONFLICT`.

## Approval

An approval has a one-to-one relation with an authorization. A human decision can be made once. Approval never grants future authority and does not change the request payload. CAPYN rechecks agent status, mandate validity, capability, vendor and spend limits before the transition to `APPROVED`.

## Execution

An execution has a one-to-one relation with an authorization. Its unique constraint is the replay barrier. Immediately before claiming execution, CAPYN rechecks the agent, the exact mandate binding, capability, vendor and current hard limits under the agent lock. v0.1 uses `MockPaymentExecutor`; a future adapter must use the CAPYN execution ID as its provider idempotency key.

## Audit event

An audit event records tenant, actor, event type, entity, timestamp and safe metadata. Application code exposes create/list only. PostgreSQL rejects updates and deletes through a trigger. Database superusers remain a trust boundary, so production exports or hash chaining may be added later.

## Organisation subscription

Every organisation has exactly one hosted subscription record. It stores the plan, lifecycle status, provider identifiers, billing period and cancellation flag. Newly bootstrapped organisations receive an internal Developer subscription in the same transaction as the organisation and owner.

Provider webhooks update the record only after raw-body signature verification, configured-price matching and provider-scoped event de-duplication. Non-paying terminal/incomplete states fall back to Developer entitlements. A subscription changes commercial allowance; it never grants a capability or bypasses policy.

## Billing usage event

Usage events are append-oriented accounting facts with a metric, integer quantity, occurrence time and exact source. `(organisationId, metric, sourceType, sourceId)` is unique. An authorization and its idempotent replay therefore map to one decision event, while approval usage maps to the exact approval request.

Active-agent and audit counts are derived from canonical domain records rather than accepting client totals. See [Billing](billing.md) for the plan catalogue and payment boundary.
