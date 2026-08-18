# Execution Gate

CAPYN Gate is the enforcement point immediately before consequence. The
control plane can decide and approve authority, but it cannot call a configured
remote provider directly. It signs one exact execution request and sends it to
the Gate; the Gate verifies and consumes that authority before its own provider
adapter can run.

The repository now contains both the reusable `@capyn/gate` protocol package
and a separately deployable Fastify service in `apps/gate`. The hosted public
alpha still selects the local mock path. The deployable service currently ships
only an AWS EC2 **dry-run blueprint validator**: it never loads AWS credentials,
never calls AWS and cannot create an instance or incur a charge.

## Claim contract

`@capyn/gate` issues compact ES256 JWS claims with protected type
`capyn-execution+jwt`. Each claim contains:

- schema version, key ID, issuer and exact Gate audience;
- issued-at, not-before and expiry timestamps;
- `EXECUTE` or `RECONCILE` operation;
- organisation, agent and mandate identity;
- authorization and execution identity;
- the leased attempt number;
- a SHA-256 hash of the canonical capability, amount, currency, vendor and
  metadata;
- a deterministic claim ID bound to the complete execution context.

The default lifetime is 30 seconds. The verifier rejects unsupported
algorithms, unknown keys, invalid signatures, future or expired claims,
excessive lifetimes, issuer/audience mismatch and any drift in the bound
context.

The action hash must also equal the request fingerprint stored when CAPYN made
the original authorization decision. The API therefore cannot reconstruct and
sign an action that differs from the durable request.

## Remote execution sequence

```text
Agent             CAPYN control             Gate                 Provider
  │                      │                     │                      │
  ├─ execute auth ID ───►│                     │                      │
  │                      ├─ lock + recheck     │                      │
  │                      ├─ claim execution    │                      │
  │                      ├─ sign exact action  │                      │
  │                      ├─ authenticated HTTP►│                      │
  │                      │                     ├─ verify signature    │
  │                      │                     ├─ verify exact request│
  │                      │                     ├─ consume claim once  │
  │                      │                     ├─ provider request ──►│
  │                      │                     │◄─ provider result ───┤
  │                      │◄─ result + receipt ─┤                      │
  │                      ├─ finalize + audit   │                      │
  │◄─ stored outcome ────┤                     │                      │
```

The Gate owns the provider invocation. The control plane does not call the
provider after a remote verification response, because doing so would leave
the credential and bypass path in the control-plane trust zone.

Pre-consumption signature, context or control-channel rejection is a
definitive failure: the Gate did not invoke the provider. Replay rejection is
different—it proves the claim was consumed earlier, so a provider call may
already exist. Replay, timeout, connection loss, HTTP 5xx or malformed response
is therefore ambiguous. CAPYN keeps that execution
`EXECUTING`, waits for the lease, then issues a separately bound `RECONCILE`
claim for the next attempt. It never converts transport ambiguity into a fresh
`EXECUTE`.

## Durable replay boundary

`ExecutionGate` uses an injected `ExecutionClaimReplayStore`. Its `consume`
operation must atomically create one record and return false when the key
already exists.

The deployable service uses `PrismaExecutionClaimReplayStore`. PostgreSQL's
composite primary key over `(namespace, claim_id)` is the atomic insert-if-absent
barrier shared by every Gate replica. The namespace binds issuer, audience and
Gate identity, so two independent Gates can consume claims without sharing an
accidental global key space. Storage failure propagates and stops execution.

Consumed records are retained; the current service does not run automated
cleanup. An operator may add bounded cleanup only after the claim expiry,
accepted skew and incident-retention window. Deleting active replay evidence
early would reopen a claim.

The in-memory store remains available for tests and the local mock only.
Production configuration explicitly refuses it.

## Control channel and key configuration

The API and Gate use a separate high-entropy bearer secret for workload
authentication in addition to the signed claim. Both services redact the
authorization header. Run the channel over authenticated private networking or
TLS; the bearer secret is not a replacement for transport security or mTLS.

The control plane reads one base64-encoded PKCS#8 P-256 private PEM, stable key
ID, issuer and audience. The Gate receives only a base64-encoded JSON map of key
IDs to SPKI public PEMs, allowing overlapping verification keys during
rotation. Partial remote configuration fails startup.

This is persistent secret-manager-compatible PEM configuration, not a KMS/HSM
signing implementation. Before live authority, replace application-loaded
private key material with a reviewed KMS/HSM signer and exercise rotation,
recovery and revocation procedures.

## Gate receipts

Every consumed invocation returns a strict receipt containing the Gate ID,
claim ID, request hash, operation, provider, outcome, provider reference,
timestamps and a canonical SHA-256 receipt digest. The HTTP client checks every
field against the dispatched request before the API records the digest and Gate
timestamps in audit metadata.

The digest detects accidental drift in the returned structure. It is **not a
signature** and does not independently prove that AWS or another provider
executed an action. Provider-native evidence, independently signed Gate
receipts and externally anchored audit export remain production work.

## AWS dry-run blueprint

The shipped adapter accepts only capability
`aws.ec2.run-instances.dry-run`, vendor `aws`, `mode=DRY_RUN`, environment
`sandbox`, one configured blueprint, its exact region and one instance. The
approved amount cannot exceed the blueprint's configured projected monthly
cost. Strict metadata rejects arbitrary AWS operation names, extra fields,
unknown blueprints, region drift and instance-count drift.

An accepted call returns an `aws_dry_run_*` reference. That means the CAPYN
boundary and fixed blueprint were exercised; it does **not** mean the AWS API
was contacted. Live `RunInstances` is deliberately unsupported.

## Provider isolation requirement

A real adapter must satisfy all of the following:

1. the provider credential, signer or assumed role is unavailable to the agent,
   model context and control-plane API;
2. only the Gate workload can use or assume that authority;
3. the Gate validates a CAPYN claim before every consequential call;
4. the provider request is constructed from the exact bound action and fixed
   adapter schema;
5. provider idempotency and reconciliation use the CAPYN execution ID;
6. provider-native evidence is returned and bound to the CAPYN execution
   record.

If the agent or API retains equivalent direct provider authority, CAPYN remains
advisory no matter how strong the claim signature is.

## Test evidence

Tests cover exact-action binding, token tampering, expiry, audience isolation,
concurrent replay, PostgreSQL uniqueness handling, separately bound
reconciliation, conservative replay classification, HTTP control
authentication, receipt matching, remote replay,
AWS blueprint drift and the complete control-plane-to-remote-Gate path.

Run the focused checks:

```bash
corepack pnpm --filter @capyn/gate test
corepack pnpm --filter @capyn/database test
corepack pnpm --filter @capyn/gate-service test
corepack pnpm --filter @capyn/api test
```

See [Configuration](configuration.md), [Deployment](deployment.md) and
[Security](security.md) before deploying this boundary.
