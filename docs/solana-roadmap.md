# Solana / USDC roadmap

CAPYN v0.4 deliberately stops before blockchain settlement. The authority engine is chain-agnostic and should be proven before adding custody and transaction complexity.

## Target sequence

```text
CAPYN policy engine
        │
        ▼
request-bound authorization
        │
        ▼
Solana transaction construction + simulation
        │
        ▼
USDC settlement
        │
        ▼
signature + outcome in execution/audit records
```

## Adapter boundary

A future `SolanaUSDCExecutor` implements the existing `PaymentExecutor` interface. It receives an already-authorized exact request. It must never evaluate vendors, capabilities or spend policy. Its `execute()` and read-only `reconcile()` methods must bind to the same CAPYN execution ID so an RPC timeout can be resolved by signature/status lookup without constructing a second transfer.

The adapter should:

1. map a CAPYN vendor ID to a verified destination account;
2. construct the exact USDC transfer;
3. simulate and validate program/account changes;
4. use CAPYN's execution ID as the provider idempotency/reconciliation key;
5. submit with controlled signing infrastructure;
6. wait for the configured commitment level;
7. persist signature, slot and final state in execution metadata;
8. emit an audit event without logging private keys or raw secrets.

## Custody approaches to evaluate

### Delegated wallet

Fastest integration, but enforcement may depend too heavily on an off-chain signer. Suitable for an early testnet adapter if the signer only accepts CAPYN-bound execution claims.

### PDA-controlled spending account

On-chain program-derived accounts can bind treasury subaccounts to authority parameters. This adds program risk and upgrade/governance requirements.

### Program enforcement

Move selected hard limits on-chain. This can add defence in depth, but CAPYN remains the richer organisation policy/evidence layer. Avoid duplicating complex policy in two inconsistent evaluators.

### Multisig treasury integration

CAPYN approvals can produce a request for an existing treasury multisig. Map CAPYN request identity to the proposal and retain both decision histories.

## Required design work

- destination registry and vendor-to-account binding;
- mint allowlist and token-account validation;
- durable nonce/blockhash expiry strategy;
- simulation and account-diff checks;
- priority fee limits;
- signer isolation/HSM or managed custody;
- duplicate submission and finality reconciliation;
- partial failure/retry semantics;
- treasury-level reservations across multiple agents;
- testnet adversarial tests before mainnet.

No CAPYN token is required. The product is authority, not tokenomics.
