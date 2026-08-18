# Execution Gate

CAPYN Gate is the cryptographic boundary between an authority decision and a
consequential provider call. It turns an internal `ALLOW` or approved request
into one short-lived, request-bound execution claim and requires that claim to
be consumed before the executor can run.

The current repository implements and tests the claim protocol and an
in-process Gate around `MockPaymentExecutor`. It does not yet deploy a remote
Gate, hold real provider credentials or make the hosted alpha safe for real
money.

## Claim contract

`@capyn/gate` issues compact ES256 JWS claims with the protected type
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
the original authorization decision. This closes a second substitution path:
the control plane cannot sign a reconstructed action that differs from the
durable request without failing before provider execution.

## Execution sequence

```text
Agent             CAPYN control             Gate                 Provider
  │                      │                     │                      │
  ├─ execute auth ID ───►│                     │                      │
  │                      ├─ lock + recheck     │                      │
  │                      ├─ claim execution    │                      │
  │                      ├─ sign exact action ─►                     │
  │                      │                     ├─ verify signature    │
  │                      │                     ├─ verify context      │
  │                      │                     ├─ consume claim once  │
  │                      │                     ├─ provider request ──►│
  │                      │                     │◄─ provider result ───┤
  │                      ├─ finalize + audit ◄─┤                      │
  │◄─ stored outcome ────┤                     │                      │
```

The Gate consumes the claim before calling the provider. If the provider then
returns an unknown outcome, CAPYN does not issue another `EXECUTE` claim. Once
the execution lease expires it issues a separately bound `RECONCILE` claim for
the next attempt and calls the provider's read-only reconciliation operation
with the original execution ID.

Gate verification failures are definitive failures because no provider call
has occurred. Exceptions after successful Gate consumption remain unknown
outcomes until reconciliation proves otherwise.

## Replay boundary

`ExecutionGate` uses an injected `ExecutionClaimReplayStore`. Its `consume`
operation must atomically create one record for a claim ID and return false if
that ID already exists. Replay entries must outlive the claim plus the accepted
clock-skew window.

The included in-memory implementation provides atomic single-process behavior
for tests and the mock alpha. It deliberately retains consumed IDs beyond
expiry so a token accepted within verifier clock skew cannot be replayed after
the nominal expiry time.

A production multi-replica Gate requires a durable shared store with an atomic
insert-if-absent primitive. A process-local map is not sufficient.

## Provider isolation requirement

Cryptographic claims are useful only if the agent cannot bypass the Gate. A
production adapter must therefore satisfy all of the following:

1. the provider credential, signer or assumed role is unavailable to the
   agent and model context;
2. only the Gate workload can use or assume that authority;
3. the Gate validates a CAPYN claim before every consequential call;
4. the provider request is constructed from the exact bound action;
5. provider idempotency and reconciliation use the CAPYN execution ID;
6. provider evidence is returned and bound to the CAPYN execution record.

If an agent retains a separate provider credential with equivalent authority,
CAPYN remains advisory no matter how strong the claim signature is.

## Key operations

The ephemeral P-256 helper exists only for local tests and the mock executor.
Attaching any non-mock executor without an explicitly configured authority and
Gate fails at service construction.

Production requires:

- persistent KMS/HSM-backed P-256 signing keys outside application storage;
- explicit key IDs and overlapping public-key rotation;
- workload-authenticated control-to-Gate transport;
- a stable issuer and per-Gate audience;
- clock monitoring and bounded skew;
- durable replay storage shared by every Gate replica;
- audit export for claim issuance, consumption and provider outcome.

The signing key proves that the CAPYN control plane issued a claim. It does not
by itself prove that a provider executed the action. Portable signed execution
receipts and externally anchored audit evidence remain separate production
work.

## Test evidence

Package tests cover exact-action binding, token tampering, expiry, audience
isolation, concurrent replay and separately bound reconciliation attempts. API
integration tests prove that a valid claim reaches the provider and a claim
signed by an untrusted key finalizes as failed without invoking it.

Run the focused checks:

```bash
corepack pnpm --filter @capyn/gate test
corepack pnpm --filter @capyn/api test
```
