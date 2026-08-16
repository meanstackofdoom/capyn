# Policy engine

`@capyn/policy-engine` is the core public technical artifact. Its single operation is pure:

```ts
evaluatePolicy(input: PolicyEvaluationInput): PolicyEvaluation
```

It has no database, network, clock or chain dependency. The caller supplies an ISO timestamp and spend totals loaded under a transaction lock.

## Evaluation order

1. Validate configuration and mandate cardinality.
2. Require an active agent.
3. Require exactly one active mandate.
4. Check mandate validity window.
5. Check the requested capability.
6. Check the normalized vendor ID against the allowlist.
7. Check the hard transaction ceiling.
8. Check projected UTC-day spend.
9. Check projected calendar-month spend.
10. If every hard rule passes, apply the approval threshold.

Any hard-rule failure produces `DENY`, even when the amount also crosses the approval threshold. Human approval is not a hard-limit override.

## Decisions

- `ALLOW`: every hard rule passes and human review is not required (or was already granted for this request).
- `DENY`: one or more hard rules fail, or policy cannot be interpreted safely.
- `REQUIRE_APPROVAL`: every hard rule passes and the amount is strictly above the review threshold.

The output contains decision-driving `reasonCodes` and a complete `trace`. A deny can contain multiple independent reasons so operators do not have to fix one rule at a time.

## Example trace

```json
[
  {
    "rule": "capability",
    "result": "PASS",
    "reasonCode": "CAPABILITY_ALLOWED",
    "details": { "requested": "spend.compute" }
  },
  {
    "rule": "dailyLimit",
    "result": "PASS",
    "reasonCode": "DAILY_LIMIT_OK",
    "details": {
      "currentSpendMinor": "1800",
      "projectedSpendMinor": "13800",
      "limitMinor": "20000"
    }
  },
  {
    "rule": "approvalThreshold",
    "result": "REVIEW",
    "reasonCode": "APPROVAL_THRESHOLD_EXCEEDED"
  }
]
```

## Money and time

- `USD 18.42` becomes the string `"1842"` minor units.
- JavaScript `number` is never used for money arithmetic.
- Daily periods begin at `00:00:00 UTC`.
- Monthly periods begin on day one at `00:00:00 UTC`.
- Mandate `validUntil` is exclusive.

## Fail-closed cases

`POLICY_CONFIGURATION_ERROR` is returned for malformed minor units, mismatched currency, empty grants/allowlists, invalid validity windows, unordered limits or multiple active mandates. The safe public description does not disclose internal configuration details; the audit trace can retain a bounded diagnostic.

## Tests

The suite covers capabilities, vendors, transaction/daily/monthly limits, expiry, inactive agents, approval, combined failures, absent mandates and malformed configuration. Run:

```bash
pnpm --filter @capyn/policy-engine test
```

When behavior changes, update this document, the REST response contract where relevant, and the catalog review date as described in [Documentation policy](documentation.md).
