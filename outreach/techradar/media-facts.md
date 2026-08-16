# CAPYN media facts

Use this as a verification sheet, not as marketing copy.

## One sentence

CAPYN is an authorization control plane that evaluates an autonomous agent's exact spending request against a versioned mandate, capabilities, vendor policy, limits and approval thresholds before execution.

## What v0.1 does

- authenticates an agent with a revocable hashed API credential;
- infers identity from the credential rather than the request body;
- returns `ALLOW`, `DENY` or `REQUIRE_APPROVAL`;
- persists explicit reason codes and a rule-by-rule trace;
- enforces idempotency and request fingerprints;
- rechecks hard policy when a human approves;
- prevents approval and execution replay;
- serializes per-agent spend accounting in PostgreSQL;
- simulates execution through `MockPaymentExecutor`;
- presents the same data in a web control plane.

## What v0.1 does not do

- move real funds;
- custody wallets or private keys;
- implement Solana, x402, AP2 or Stripe settlement;
- claim production certification;
- provide a token or DAO;
- solve multi-agent shared-treasury locking yet.

## Demonstration policy

```text
Agent: procurement-agent
Capabilities: spend.compute, spend.api
Vendors: OpenAI, Anthropic, AWS
Hard transaction limit: $150
UTC daily limit: $200
Calendar monthly limit: $2,000
Human approval above: $100
transfer.wallet: not granted
```

The hard transaction ceiling is `$150` because a `$50` hard maximum cannot consistently produce an approval outcome for the requested `$120` demo. CAPYN never lets approval override a hard maximum.

## Suggested live questions

- Why is CAPYN distinct from a payment rail?
- Why are awaiting approvals rechecked instead of treated as future permission?
- How do two simultaneous requests interact with one daily limit?
- What remains before real-money deployment?
- How can the same authority model extend beyond payments?
