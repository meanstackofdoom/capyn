# Security

CAPYN is security-sensitive infrastructure. The developer alpha establishes boundaries and demonstrates the controls, but it is not yet certified or ready to custody production funds.

## Implemented controls

### Authentication and identity

- Agent identity is inferred from a bearer API key; request bodies cannot choose `agentId`.
- Keys contain 256 bits of cryptographically strong key material.
- Only an HMAC-SHA-256 hash and short prefix are stored.
- The server rejects revoked keys with the same response as unknown keys.
- Owner/admin rotation atomically replaces and revokes one exact credential under the agent lock.
- Rotation retries are idempotent without plaintext storage, and a captured principal is revalidated inside consequential authorization and execution transactions.
- Agent revocation is terminal, revokes active credentials and prevents replacement credentials.
- Human role checks execute in API handlers, never in the browser alone.
- Durable workspace owners authenticate with a separate `capyn_owner_live_…` credential whose HMAC digest, prefix, user and organisation binding are stored; a failed bearer credential never falls back to demo authentication.
- Production demo configuration refuses to start unless its header adapter is pinned to one explicit user; the public alpha pins it to an approver, so owner/admin routes remain unavailable even though seeded IDs are public.

`API_KEY_PEPPER` must be a high-entropy deployment secret kept outside the database. Key hashing is appropriate here because generated keys already have high entropy; password hashing is not required for brute-force resistance.

### Stateless public sandbox

- `/v1/sandbox/activate` seals a bounded identity and mandate into a versioned AES-256-GCM credential derived from a domain-separated deployment pepper.
- The API authenticates and decrypts that credential before constructing policy input; the authorization body still cannot choose an agent identity.
- Credentials expire after 30 minutes, invalid and tampered envelopes return one generic authentication error, and secrets are redacted by the existing authorization-header log rule.
- Activation and authorization have separate strict IP rate limits, strict schemas and the global 32 KiB body ceiling.
- The browser holds plaintext only in component memory and does not place the credential in storage, cookies, query strings or proof links.
- The sandbox is synthetic and stateless: it creates no durable identity or spend record and never reaches a real executor.

Statelessness means an issued sandbox credential cannot be individually revoked before expiry and repeated requests do not accumulate spend. It must never be accepted by durable `/v1/authorize` or used as a production credential. See [Sandbox commissioning](sandbox-commissioning.md).

### One-way durable claim

- `/v1/onboarding/launch` authenticates and inspects the exact sandbox credential before any persistent write.
- One HMAC fingerprint of the sandbox credential can appear in only one production-launch record, preventing a second workspace claim.
- The required idempotency key is bound to the sandbox fingerprint and normalized request; exact retry is recoverable while any drift conflicts.
- Organisation, owner, agent, mandate, subscription, both credential digests, claim record and launch audit events are written in one transaction.
- Owner and agent plaintext credentials are derived from distinct HMAC domains and returned only in the launch/replay response. The database stores neither plaintext.
- The browser retains only the owner key, in tab-scoped `sessionStorage`, after an explicit dashboard handoff. It never stores the agent key.
- Team/Business intent cannot self-assert an entitlement. Developer remains active until a verified billing webhook changes the subscription.

The route is an onboarding boundary, not a live execution boundary. It imports the already-proved capabilities, vendor list and spend limits without widening them. See [Durable onboarding](durable-onboarding.md).

### Tenant isolation

Authenticated principals carry an organisation ID loaded server-side. Every resource lookup compares the stored organisation and returns not found across tenant boundaries. The test suite covers cross-organisation authorization reads and approval decisions.

Production defence in depth should add PostgreSQL row-level security or isolated database roles once the tenancy/deployment model is final.

### Request safety

- Strict Zod objects reject unknown fields.
- Body size is capped at 32 KiB and metadata at 8 KiB.
- Amounts are decimal strings and convert to integer minor units.
- Only USD is accepted in v0.4.
- Structured errors do not return stacks or database details.
- Authorization, bootstrap and Stripe-signature headers are redacted from structured logs.
- Fastify rate limiting provides an adapter point; production needs a distributed Redis-backed store and agent-aware keys.

### Idempotency and replay

- `Idempotency-Key` is mandatory for `/v1/authorize`.
- The normalized canonical request is SHA-256 fingerprinted.
- `(agentId, idempotencyKey)` is unique.
- `(agentId, rotationIdempotencyKey)` is unique; the same source returns the same replacement and a different source conflicts.
- Approval can transition from `PENDING` once.
- One execution record can exist per authorization.
- Repeated completed execution calls return the original result and never call the executor again.
- Pending execution attempts hold a time-bounded lease; only one expired attempt can claim reconciliation under the agent lock.
- Unknown provider outcomes remain `EXECUTING` and reserved. An exact retry calls `reconcile()` with the original execution ID rather than issuing payment again.
- Finalization is attempt-conditional, so a slow superseded attempt cannot overwrite a newer reconciliation result.
- Immediately before execution, CAPYN rechecks the agent, exact mandate binding, capability, vendor and hard spend rules under the agent lock. Suspension, revocation or mandate replacement invalidates an unused authorization.

### Execution claims and Gate

- Every provider execution and reconciliation attempt is preceded by a short-lived ES256 claim with protected type `capyn-execution+jwt`.
- The claim binds the exact organisation, agent, mandate, authorization, execution, leased attempt, operation and canonical request hash.
- The Gate verifies the signature before evaluating request context, requires the configured issuer and exact audience, and enforces a bounded lifetime.
- The stored authorization fingerprint must match the reconstructed execution action before CAPYN dispatches to a gateway.
- The Gate atomically consumes the deterministic claim ID before invoking the provider. `PrismaExecutionClaimReplayStore` uses a namespaced PostgreSQL primary key shared across replicas; storage failure stops execution.
- `EXECUTE` and read-only `RECONCILE` claims are distinct; reconciliation cannot reopen the original execution operation.
- In remote mode the Gate, not the API, owns provider invocation. The agent and API must not hold equivalent provider authority.
- Pre-consumption signature/context and control rejection finalizes as failure. Replay, network loss or server failure is unknown because the Gate may already have consumed and invoked; reconciliation is the only safe next operation.
- The API validates the Gate ID, provider, claim, action, outcome and receipt digest before retaining Gate evidence in execution audit metadata.
- Production Gate configuration refuses process-local replay storage.

The hosted alpha still uses an ephemeral in-process Gate and mock executor. The
repository also includes an authenticated deployable Gate, PostgreSQL replay
adapter, key rotation map and fixed AWS dry-run blueprint. The dry-run adapter
does not load AWS credentials or call AWS. Persistent PEM configuration is not
a KMS/HSM signer. When a shared receipt-signing secret is configured, the Gate
signs every receipt with HMAC-SHA-256 and the API fails closed on an unsigned
or tampered receipt; this is workload tamper evidence, not externally anchored
provider evidence. See [Execution Gate](execution-gate.md).

### Concurrent spend accounting

PostgreSQL authorization and approval operations use:

1. `SERIALIZABLE` transaction isolation;
2. a transaction-scoped advisory lock derived from the agent ID;
3. projected daily/monthly spend that includes live `ALLOWED`, `APPROVED`, `EXECUTING` and `EXECUTED` reservations;
4. a full hard-policy recheck when approval is granted.

This prevents two CAPYN API requests for one agent from trivially observing the same available balance and both reserving it. Tests issue four simultaneous `$30` authorization requests against a `$100` daily limit and assert that three are allowed while the fourth is denied. Separate tests cover approval races against one request and against a shared daily cap.

The single-service volume adapter provides the equivalent in-process serialization with one repository-wide mutex and acknowledges a transaction only after atomic checkpoint replacement. It must never be mounted by multiple API processes; PostgreSQL is required before horizontal scale or stronger database isolation guarantees.

Cross-agent constraints on a shared treasury are not yet implemented. Add a treasury-level lock and reservation ledger before multiple agents share one aggregate budget.

### Billing isolation and replay

- Hosted plan checks run on the server from the authenticated principal's organisation.
- Free-plan decision and active-agent quotas use a transaction-scoped organisation lock.
- Authorization usage is source-bound to one authorization ID, so idempotent retries cannot be charged twice.
- Checkout and portal sessions are restricted to owners/admins.
- Stripe webhook signatures are verified over the raw body before an entitlement can change.
- Provider/event-ID pairs are unique and ingested once.
- Subscription create/update events re-fetch current provider state; events for an obsolete subscription ID cannot replace a different live subscription and are audited as ignored.
- Active, trialing and past-due subscriptions retain their paid plan during provider retry handling; incomplete, unpaid, paused or canceled states fail back to bounded Developer entitlements.
- Subscription state cannot override an agent mandate, a hard spend limit or a policy denial.

### Audit integrity

Audit entries are append-only through repository interfaces. A PostgreSQL trigger rejects update/delete. Normal application roles should not own the trigger or receive elevated DDL permissions.

For regulated deployments, add immutable external export, retention policy, clock monitoring, cryptographic event chaining and SIEM delivery.

## Known alpha limitations

- The public demonstration still uses a pinned, least-privilege header adapter alongside durable owner-key authentication. The pinned principal can access only the isolated synthetic demo tenant; disable the adapter entirely in a dedicated customer or real-money deployment.
- Owner access keys are long-lived alpha recovery credentials. Tab logout removes the local copy but is not server-side revocation; self-service owner-key rotation, account recovery, MFA and session inventory are not implemented.
- The fixed public agent key lets visitors consume the isolated synthetic demo's allowance. Rate limits bound request volume and the public instance makes no availability promise; durable workspaces receive unique revocable agent credentials.
- The current Railway volume journal is a single-process hosted-alpha fallback. It has atomic checkpoints but no multi-replica locking, managed backups, point-in-time recovery or database row-level security.
- `MockPaymentExecutor` moves no funds.
- The public alpha selects the in-process mock Gate. The remote Gate and durable replay implementation are test-backed but are not deployed as the public alpha's credential boundary.
- The only shipped remote provider is a no-network AWS blueprint dry run. There is no reviewed live provider adapter, exclusive AWS role, CloudTrail evidence or chargeable operation.
- The control plane currently loads base64 PKCS#8 private PEM from its secret scope. KMS/HSM signing, rotation automation and recovery drills are not implemented.
- Gate receipts carry a checked canonical digest and, when configured, a shared-secret HMAC signature that the API verifies, but they are not independently signed with asymmetric provider evidence or externally anchored.
- Request-driven leased reconciliation can recover an `EXECUTING` record after a lost provider response, and an optional background sweep (`CAPYN_EXECUTION_SWEEP_ENABLED`) claims the same lease-conditioned reconciliation automatically. Concurrent sweeper instances stay safe because claiming is atomically conditional; there is no distributed single-sweeper lock. Real adapters still require provider idempotency, a transactional outbox, provider-side automation and alerting.
- Rate-limit state is process-local.
- Awaiting approvals do not reserve spend for 24 hours. Hard limits are rechecked at approval time instead.
- Spend periods use authorization creation time. A production ledger should distinguish reservation, capture and refund timestamps.
- Refunds, reversals, partial captures and currency conversion are not implemented.
- No anomaly detection, sanctions screening or vendor risk intelligence exists.
- Database administrators remain able to alter data outside application controls.
- Automated delivery of overage usage to Stripe meters is not implemented; paid overage remains a local projection/manual reconciliation boundary.

## Production gate

Before real money:

- independent threat model and security review;
- real human SSO/MFA and session controls;
- treasury-level reservation model;
- distributed rate limiting and abuse detection;
- one reviewed real executor plus transactional outbox, provider-side automation and alerting;
- a separately deployed or customer-controlled Gate with exclusive provider authority, the implemented durable atomic replay store, authenticated private transport and tested database recovery;
- persistent KMS/HSM-backed execution-claim keys with rotation and recovery procedures;
- secret-manager integration and deployment-pepper rotation;
- encrypted backups, tested restore and disaster recovery;
- audit export/retention controls;
- observability, alerts and incident runbooks;
- dependency/SBOM/vulnerability pipeline;
- legal and compliance review for supported jurisdictions and payment flow.

The live completion boundary and owner-dependent launch actions are tracked in the private deployment record outside this repository.
