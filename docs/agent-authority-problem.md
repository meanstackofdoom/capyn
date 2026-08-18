# The Agent Authority Problem

Autonomous software can already call APIs, hold credentials and initiate payments. The hard problem is no longer whether an agent can act. It is whether a principal can prove the agent was permitted to take one consequential action under explicit constraints.

Six questions separate access from authority:

```text
Authentication  Who is the agent?
Authorization   What may this agent do?
Intent          What exact action did the principal delegate?
Policy          Under which constraints is it permitted?
Execution       What actually happened?
Audit           Can the organisation prove the chain of events?
```

Traditional API keys answer only part of the first question. A wallet balance answers none of the others.

## Bounded delegation

Useful autonomous agents need authority that is:

- scoped by capability rather than broad account access;
- bounded by vendor, amount and time;
- re-evaluated for every action;
- escalated to a human at explicit thresholds;
- bound to the exact approved request;
- replay-resistant;
- visible after the fact as evidence, not just a log line.

This is closer to IAM than to a consumer wallet. The financial wedge makes failures measurable and consequential, but the model generalises to infrastructure changes, data access, procurement, deployment and other operational actions.

## The decision point

Payment protocols and settlement networks answer how value moves. They should not each become an organisation's source of truth for what an agent was allowed to do.

An authority control plane sits before them:

```text
Agent request
     │
     ▼
Identity ─ Mandate ─ Policy ─ Current state
     │
     ▼
ALLOW / DENY / REQUIRE_APPROVAL
     │
     ▼
Signed exact-action claim
     │
     ▼
Gate ─ Execution adapter
```

The result is not a reusable permission. It is an answer about one normalized request at one time under one mandate version.

## Security properties worth testing

The interesting failures are not the happy-path API call:

- twenty simultaneous requests against one daily limit;
- approval after a mandate was revoked;
- approval after another request consumed the remaining budget;
- an agent submitting another agent's ID;
- reuse of an idempotency key with a modified payload;
- two execution calls for one authorization;
- a signed claim replayed or presented with a modified action;
- an agent bypassing the Gate with a retained provider credential;
- an external provider succeeding before the local process crashes;
- a vendor label that resolves to a different destination account.

A credible authority product makes these invariants visible in code, tests and documentation. CAPYN's public alpha continues from that foundation with authenticated sandbox commissioning, portable proof, a one-way claim into durable tenant records and an in-process cryptographic Gate around mock execution. The repository now also proves a separately deployable Gate, durable replay and an AWS-shaped dry-run boundary. Exclusive live provider authority, KMS/HSM signing and provider-native evidence remain deliberately unfinished.
