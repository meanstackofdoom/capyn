# @capyn/types

Shared Zod schemas and TypeScript contracts for CAPYN authority requests,
mandates, decisions, approvals, execution and billing.

## Install

```bash
pnpm add @capyn/types
```

Node.js 22 or newer is required.

```ts
import {
  authorizeRequestSchema,
  authorizationResultSchema,
  type AuthorizeRequest,
  type AuthorizationResult
} from "@capyn/types";
```

Use these contracts when integrating directly with the CAPYN REST API or
building a compatible policy adapter. Most agent applications should start with
[`@capyn/sdk`](https://www.npmjs.com/package/@capyn/sdk).

## Source and licence

[CAPYN on GitHub](https://github.com/meanstackofdoom/capyn) · MIT

