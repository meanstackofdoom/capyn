# @capyn/sdk

Typed client for asking CAPYN to authorize consequential agent actions.

CAPYN returns one of three explicit outcomes: `ALLOW`, `DENY`, or
`REQUIRE_APPROVAL`. The SDK authenticates one agent, supplies a replay-safe
idempotency key, and validates authorization responses.

## Install

```bash
pnpm add @capyn/sdk
```

Node.js 22 or newer is required.

## Authorize one exact action

```ts
import { Capyn } from "@capyn/sdk";

const capyn = new Capyn({
  apiKey: process.env.CAPYN_API_KEY!,
  baseUrl: process.env.CAPYN_API_URL
});

const result = await capyn.authorize({
  capability: "spend.compute",
  amount: { value: "18.42", currency: "USD" },
  vendor: { id: "openai" },
  metadata: { purpose: "Purchase inference capacity" }
});

if (result.decision === "ALLOW") {
  // Continue with this exact action.
}
```

The API infers agent identity from the key. Do not place an agent identifier in
the request body.

## Boundary

The public CAPYN deployment is a synthetic developer alpha with mock execution.
Do not send it customer data, provider credentials, or real settlement
instructions. Read the [security model](https://capyn-production.up.railway.app/docs/security)
before building a non-demo deployment.

## Source and licence

[CAPYN on GitHub](https://github.com/meanstackofdoom/capyn) · MIT

