# Security

CAPYN is security-sensitive infrastructure. v0.1 establishes boundaries and demonstrates the controls, but it is not yet certified or ready to custody production funds.

## Implemented controls

### Authentication and identity

- Agent identity is inferred from a bearer API key; request bodies cannot choose `agentId`.
- Keys contain 256 bits of random material.
- Only an HMAC-SHA-256 hash and short prefix are stored.
- The server rejects revoked keys with the same response as unknown keys.
- Agent revocation also revokes active credentials.
- Human role checks execute in API handlers, never in the browser alone.

`API_KEY_PEPPER` must be a high-entropy deployment secret kept outside the database. Key hashing is appropriate here because generated keys already have high entropy; password hashing is not required for brute-force resistance.

### Tenant isolation

Authenticated principals carry an organisation ID loaded server-side. Every resource lookup compares the stored organisation and returns not found across tenant boundaries. The test suite covers cross-organisation authorization reads and approval decisions.

Production defence in depth should add PostgreSQL row-level security or isolated database roles once the tenancy/deployment model is final.

### Request safety

- Strict Zod objects reject unknown fields.
- Body size is capped at 32 KiB and metadata at 8 KiB.
- Amounts are decimal strings and convert to integer minor units.
- Only USD is accepted in v0.1.
- Structured errors do not return stacks or database details.
- Authorization and bootstrap headers are redacted from structured logs.
- Fastify rate limiting provides an adapter point; production needs a distributed Redis-backed store and agent-aware keys.

### Idempotency and replay

- `Idempotency-Key` is mandatory for `/v1/authorize`.
- The normalized canonical request is SHA-256 fingerprinted.
- `(agentId, idempotencyKey)` is unique.
- Approval can transition from `PENDING` once.
- One execution record can exist per authorization.
- Repeated completed execution calls return the original result and never call the executor again.

### Concurrent spend accounting

PostgreSQL authorization and approval operations use:

1. `SERIALIZABLE` transaction isolation;
2. a transaction-scoped advisory lock derived from the agent ID;
3. projected daily/monthly spend that includes live `ALLOWED`, `APPROVED`, `EXECUTING` and `EXECUTED` reservations;
4. a full hard-policy recheck when approval is granted.

This prevents two CAPYN API requests for one agent from trivially observing the same available balance and both reserving it. Tests issue four simultaneous `$30` authorization requests against a `$100` daily limit and assert that three are allowed while the fourth is denied. A separate test issues concurrent approvals against a daily cap and asserts only one succeeds.

Cross-agent constraints on a shared treasury are not yet implemented. Add a treasury-level lock and reservation ledger before multiple agents share one aggregate budget.

### Audit integrity

Audit entries are append-only through repository interfaces. A PostgreSQL trigger rejects update/delete. Normal application roles should not own the trigger or receive elevated DDL permissions.

For regulated deployments, add immutable external export, retention policy, clock monitoring, cryptographic event chaining and SIEM delivery.

## Known v0.1 limitations

- Human authentication is a demo header adapter. Disable `DEMO_HUMAN_AUTH` and install a real identity adapter before deployment.
- `MockPaymentExecutor` moves no funds.
- A process crash after an external provider succeeds but before CAPYN finalizes can leave `EXECUTING`. Real adapters need provider idempotency, reconciliation and an outbox/state-machine worker.
- Rate-limit state is process-local.
- Awaiting approvals do not reserve spend for 24 hours. Hard limits are rechecked at approval time instead.
- Spend periods use authorization creation time. A production ledger should distinguish reservation, capture and refund timestamps.
- Refunds, reversals, partial captures and currency conversion are not implemented.
- API-key rotation overlap is manual.
- No anomaly detection, sanctions screening or vendor risk intelligence exists.
- Database administrators remain able to alter data outside application controls.

## Production gate

Before real money:

- independent threat model and security review;
- real human SSO/MFA and session controls;
- treasury-level reservation model;
- distributed rate limiting and abuse detection;
- executor idempotency/reconciliation;
- secret manager and key rotation;
- encrypted backups, tested restore and disaster recovery;
- audit export/retention controls;
- observability, alerts and incident runbooks;
- dependency/SBOM/vulnerability pipeline;
- legal and compliance review for supported jurisdictions and payment flow.

The live completion boundary and owner-dependent launch actions are tracked in [Project status](project-status.md).
