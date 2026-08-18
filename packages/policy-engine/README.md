# @capyn/policy-engine

Deterministic, side-effect-free and fail-closed authority policy evaluation for
autonomous agents.

## Install

```bash
pnpm add @capyn/policy-engine @capyn/types
```

Node.js 22 or newer is required.

## Evaluate

```ts
import { evaluatePolicy } from "@capyn/policy-engine";
import type { PolicyEvaluationInput } from "@capyn/types";

const input: PolicyEvaluationInput = {
  now: "2026-08-18T00:00:00.000Z",
  agent: { id: "agt_1", status: "ACTIVE" },
  activeMandateCount: 1,
  mandate: {
    id: "man_1",
    name: "Compute spend",
    version: 1,
    status: "ACTIVE",
    validFrom: "2026-08-01T00:00:00.000Z",
    validUntil: "2026-09-01T00:00:00.000Z",
    capabilities: ["spend.compute"],
    policy: {
      currency: "USD",
      allowedVendorIds: ["openai"],
      perTransactionLimitMinor: "15000",
      dailyLimitMinor: "20000",
      monthlyLimitMinor: "200000",
      approvalThresholdMinor: "10000"
    }
  },
  request: {
    capability: "spend.compute",
    amountMinor: "1842",
    currency: "USD",
    vendor: { id: "openai" },
    metadata: { purpose: "Purchase inference capacity" }
  },
  spend: { dailyMinor: "0", monthlyMinor: "0" },
  approvalAlreadyGranted: false
};

const result = evaluatePolicy(input);
// result.decision: "ALLOW" | "DENY" | "REQUIRE_APPROVAL"
```

Callers remain responsible for authenticating identity and loading spend totals
under the appropriate transaction lock. The evaluator does not execute payments
or mutate state.

Run the complete example:

```bash
git clone https://github.com/meanstackofdoom/capyn.git
cd capyn
corepack pnpm install
corepack pnpm demo
```

## Source and licence

[CAPYN on GitHub](https://github.com/meanstackofdoom/capyn) · MIT
