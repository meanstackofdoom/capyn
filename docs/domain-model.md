# Domain model

## Organisation

The tenant boundary. Every agent, mandate, authorization, approval, execution and audit event belongs to one organisation. Service methods check organisation ownership before returning a resource, including not-found responses for cross-tenant IDs.

## User

A human principal with one role:

- `OWNER`: full organisation authority;
- `ADMIN`: operational administration;
- `APPROVER`: approve or reject exact requests;
- `VIEWER`: read-only control-plane access.

The v0.4 hosted alpha accepts an owner credential for durable tenants and retains the pinned `x-capyn-user-id` adapter only for the isolated public demonstration. The `AuthAdapter` boundary is where SSO/MFA or an enterprise identity provider can be added.

A `UserCredential` belongs to exactly one user. As with agent credentials, CAPYN stores only a prefix, HMAC-SHA-256 digest and lifecycle timestamps. The one-time `capyn_owner_live_…` plaintext is returned during durable onboarding and can authenticate only human management endpoints.

## Agent and credential

An `Agent` is an autonomous software identity with status `ACTIVE`, `SUSPENDED` or `REVOKED`.

An `AgentCredential` belongs to exactly one agent. CAPYN generates 256 bits of random key material, returns plaintext once, and persists only:

- a display prefix;
- an HMAC-SHA-256 hash using `API_KEY_PEPPER`;
- creation, last-used and revocation timestamps.

An atomic rotation also stores the source credential ID and an agent-scoped idempotency reference. The replacement key is derived with domain-separated HMAC input from the deployment pepper and a random credential ID, allowing an exact retry to recover the same response without persisting plaintext. The source revocation, replacement creation and `API_KEY_ROTATED` audit event share the agent-locked transaction. A reused idempotency key cannot rotate a different source credential.

Revoking an agent is terminal: it revokes active credentials, prevents replacement credentials and cannot be reversed through the management API. Suspending an agent preserves credentials but the policy engine returns `AGENT_INACTIVE`.

## Mandate

A mandate is a versioned, time-bounded grant to one agent. It contains namespaced capability strings and one spending policy. Creating a new active version revokes the previous active version inside the same transaction.

Mandate activation runs under the agent lock and revokes the previous active version in the same serializable transaction. The policy engine independently fails closed if an inconsistent store ever supplies more than one active mandate.

## Spending policy

v0.4 stores:

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

An execution has a one-to-one relation with an authorization. Its unique constraint is the replay barrier. Immediately before claiming execution, CAPYN rechecks the agent, the exact mandate binding, capability, vendor and current hard limits under the agent lock. v0.4 uses `MockPaymentExecutor`; a future adapter must use the CAPYN execution ID as its provider idempotency key.

Each pending execution records an attempt count, last-attempt timestamp and lease expiry. A thrown or explicitly unknown provider result keeps the execution pending and the authorization `EXECUTING`, so its spend remains reserved. Once the lease expires, one exact retry can claim reconciliation under the agent lock and call the same executor's read-only `reconcile()` method. Conditional finalization prevents an older, slow attempt from overwriting a newer reconciliation result. Completed executions replay their stored outcome without touching the provider.

## Audit event

An audit event records tenant, actor, event type, entity, timestamp and safe metadata. Application code exposes create/list only. PostgreSQL rejects updates and deletes through a trigger. The single-service journal has no update/delete repository methods but lacks a database trigger; volume administrators remain a trust boundary. Production exports or hash chaining may be added later.

## Organisation subscription

Every organisation has exactly one hosted subscription record. It stores the plan, lifecycle status, provider identifiers, billing period and cancellation flag. Newly bootstrapped organisations receive an internal Developer subscription in the same transaction as the organisation and owner.

Provider webhooks update the record only after raw-body signature verification, configured-price matching and provider-scoped event de-duplication. Non-paying terminal/incomplete states fall back to Developer entitlements. A subscription changes commercial allowance; it never grants a capability or bypasses policy.

## Billing usage event

Usage events are append-oriented accounting facts with a metric, integer quantity, occurrence time and exact source. `(organisationId, metric, sourceType, sourceId)` is unique. An authorization and its idempotent replay therefore map to one decision event, while approval usage maps to the exact approval request.

Active-agent and audit counts are derived from canonical domain records rather than accepting client totals. See [Billing](billing.md) for the plan catalogue and payment boundary.

## Production launch

A `ProductionLaunch` is the one-way replay barrier between a stateless sandbox claim and a durable workspace. It uniquely binds the sandbox credential fingerprint, idempotency key, normalized request hash, organisation, owner, agent, mandate and both credential records. It also retains the selected plan intent and mandate expiry needed to reconstruct an exact onboarding response without storing plaintext credentials.

The record name describes the transition into the durable product surface; it does not claim production execution. The response remains `HOSTED_ALPHA` with `MockPaymentExecutor`.
