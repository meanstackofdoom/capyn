# Architecture

CAPYN separates the authority decision from the mechanism that eventually executes it.

```text
Human / organisation
        │
        ▼
 Identity + treasury
        │
        ▼
       CAPYN
        │
        ├── agent identity
        ├── versioned mandate
        ├── pure policy evaluation
        ├── request-bound approval
        └── append-oriented audit
        │
        ▼
 PaymentExecutor execute + reconcile interface
        │
        ├── MockPaymentExecutor (v0.1)
        └── future adapters: Solana / x402 / Stripe / AP2
```

## Workspace boundaries

| Boundary | Responsibility | Must not do |
|---|---|---|
| `@capyn/types` | Schemas, public contracts, money conversion | Access infrastructure |
| `@capyn/policy-engine` | Pure `PolicyEvaluationInput → PolicyEvaluation` | Query a database or execute payment |
| `@capyn/database` | Persistence, transaction/locking primitives, projections | Make an HTTP decision |
| `@capyn/billing` | Pure plan catalogue, entitlements and overage calculation | Change policy decisions or call a payment provider |
| `apps/api` | Authentication, orchestration, lifecycle, safe HTTP errors | Trust client agent identity |
| `@capyn/sdk` | Typed agent-facing client | Contain policy rules |
| `apps/web` | Public website, canonical docs renderer and human control plane | Enforce authority in the browser |

## Authorization sequence

```text
Agent                 API                 PostgreSQL             Policy engine
  │                    │                      │                       │
  ├─ Bearer key ──────►│                      │                       │
  │                    ├─ HMAC lookup ───────►│                       │
  │                    ├─ serializable tx ───►│                       │
  │                    ├─ organisation lock ─►│                       │
  │                    ├─ agent advisory lock►│                       │
  │                    ├─ idempotency lookup ►│                       │
  │                    ├─ hosted allowance ──►│                       │
  │                    ├─ context + spend ───►│                       │
  │                    ├─────────────────────────────────────────────►│
  │                    │◄──────── decision + reason trace ───────────┤
  │                    ├─ auth + usage + approval? + audit ────────►│
  │◄─ deterministic ───┤                      │                       │
```

The transaction lock makes the spend snapshot and the newly reserved `ALLOWED` authorization one serial operation. An awaiting approval is not reserved indefinitely; its exact mandate binding and all hard limits are re-evaluated under the same lock when a human approves it. Execution acquires the same agent lock, reloads the authorization, and re-evaluates the current agent, exact mandate binding, capability, vendor and hard limits before it claims the one execution record. A suspension, revocation or replacement mandate invalidates unused authority instead of letting a stale decision move forward.

The organisation lock serializes hosted quota checks across different agents. Billing is orchestration around the evaluator: exhausting a bounded free allowance can stop a new hosted request, but no billing code can turn a failed policy rule into permission.

## Lifecycle

```text
REQUESTED
   ├── DENIED
   ├── ALLOWED ───────────────┐
   └── AWAITING_APPROVAL      │
          ├── REJECTED        │
          ├── EXPIRED         │
          └── APPROVED ───────┤
                              ▼
                          EXECUTING
                           ├── EXECUTED
                           ├── FAILED
                           └── UNKNOWN OUTCOME
                                  │ lease expires
                                  └── reconcile same execution ID
```

Transitions are server-side service operations. A client cannot set an authorization state. `EXPIRED` also represents an unused authorization invalidated by a changed authority context; its audit event preserves the machine-readable reason.

## Persistence

PostgreSQL is the production persistence target. Prisma supplies typed access, while the migration adds invariants Prisma cannot express:

- one active mandate per agent (partial unique index);
- valid mandate windows;
- ordered positive spend limits;
- positive authorization amounts;
- one credential-rotation idempotency record per agent and source-bound replacement lineage;
- leased execution attempts with a recovery index over pending lease expiry;
- an update/delete prevention trigger on audit events.

The in-memory repository implements the same interface for deterministic API/security tests and the one-command demo. It is not a production store.

## Deployment shape

For an initial managed deployment:

```text
Browser ──► Next.js web
                │
                ▼
Agent ─────► Fastify API ─────► PostgreSQL
                │
                └─────────────► executor adapter
```

The API should be the only component with database write access. A real human identity provider replaces the demo header adapter. CAPYN now supports request-driven reconciliation of leased ambiguous executions, but distributed rate limiting, database backups, audit export, a durable executor worker/outbox and provider-specific reconciliation operations remain required before production money movement. See [Deployment](deployment.md) for the platform-neutral service handoff.
