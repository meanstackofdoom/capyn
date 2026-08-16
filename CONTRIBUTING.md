# Contributing to CAPYN

CAPYN's policy and authorization paths are security-sensitive. Changes should preserve fail-closed behavior, explicit reason codes, organisation isolation, integer money accounting, request-bound approvals, and append-oriented audit evidence.

## Local verification

Use Node.js 22+ and pnpm 11.8.0 through Corepack:

```bash
corepack pnpm install
corepack pnpm docs:check
corepack pnpm check
corepack pnpm demo
```

Tests that alter policy behavior should cover the pure evaluator and the HTTP/security boundary. Schema changes require a checked-in Prisma migration and an update to the relevant domain/security documentation. The public documentation site renders `/docs` directly; keep `docs/catalog.json` and its review metadata current according to [docs/documentation.md](docs/documentation.md).

## Pull requests

Keep changes focused and explain:

- the authority or threat-model behavior being changed;
- whether the change can grant, reserve, approve, execute, or revoke authority;
- concurrency and idempotency implications;
- tests and documentation added;
- intentionally deferred risks.

Do not commit secrets, real agent credentials, production transaction data, or generated build output. Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).
