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

Revoking an agent also revokes its active credentials. Suspending an agent preserves credentials but the policy engine returns `AGENT_INACTIVE`.

## Mandate

A mandate is a versioned, time-bounded grant to one agent. It contains namespaced capability strings and one spending policy. Creating a new active version revokes the previous active version inside the same transaction.

The database guarantees at most one active mandate per agent. The policy engine still fails closed if an inconsistent repository ever supplies more than one.

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

An execution has a one-to-one relation with an authorization. Its unique constraint is the replay barrier. v0.1 uses `MockPaymentExecutor`; a future adapter must use the CAPYN execution ID as its provider idempotency key.

## Audit event

An audit event records tenant, actor, event type, entity, timestamp and safe metadata. Application code exposes create/list only. PostgreSQL rejects updates and deletes through a trigger. Database superusers remain a trust boundary, so production exports or hash chaining may be added later.
