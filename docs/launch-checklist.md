# Public alpha launch checklist

This is CAPYN's 20-gate release register for the public alpha. A verified code gate means the repository contains the control and its automated evidence passed on 17 August 2026. It does not redefine the separate production gate for real funds.

| # | Gate | Evidence | Status |
|---:|---|---|---|
| 1 | Repository hygiene | Secret, placeholder, Java, Docker and debug-output sweep | Verified |
| 2 | Environment boundary | Strict environment parsing, log redaction and explicit proxy trust | Verified |
| 3 | Commercial contract | One plan catalogue drives limits, pricing and entitlements | Verified |
| 4 | Payment readiness | Stripe Checkout, portal and signed webhook adapters | Verified |
| 5 | Tenant security | Organisation-scoped queries, role checks and IDOR tests | Verified |
| 6 | Quota concurrency | Organisation and agent locks guard usage and spend reservations | Verified |
| 7 | Authority lifecycle | Approval races, replay, revocation and execution-time revalidation tested | Verified |
| 8 | Persistent billing | Prisma subscription, usage and webhook schema plus migration invariants | Verified |
| 9 | Product narrative | Four seeded decisions match the public demonstration | Verified |
| 10 | API journey | Authorization, approval and mock execution smoke path | Verified |
| 11 | Website journey | Public, docs and dashboard route smoke coverage | Verified |
| 12 | Search metadata | Titles, descriptions, canonicals, Open Graph and JSON-LD | Verified |
| 13 | Crawl and headers | Robots, sitemap, manifest, noindex and security headers | Verified |
| 14 | Interaction quality | Responsive, reduced-motion, keyboard and console review | Verified |
| 15 | Documentation | Canonical Markdown catalog rendered directly by the website | Verified |
| 16 | Release record | Changelog, explicit deferrals and this evidence register | Verified |
| 17 | Full verification | Lint, typecheck, unit/API/security tests and production builds | Verified |
| 18 | Production smoke | Built web and API exercised on isolated non-default ports | Verified |
| 19 | Public revision | Audited commits pushed and remote CI confirmed | Verified |
| 20 | Hosting cutover | Recoverable prior-service compute stop, CAPYN deploy and hosted verification | Verified |

## Commands

Run the complete repository gate:

```bash
corepack pnpm check
corepack pnpm audit --prod --audit-level high
corepack pnpm smoke:production
git diff --check
```

`smoke:production` starts the built API and web services temporarily on ports `4110` and `3110`, verifies the four policy outcomes and public surfaces, then releases both ports. `smoke:combined` verifies the constrained one-service Railway adapter on three additional non-default ports. Neither requires Docker.

## Hosted evidence

The synthetic public alpha is live at [capyn-production.up.railway.app](https://capyn-production.up.railway.app). The 17 August 2026 cutover was verified against the deployed GitHub revision and a green remote CI run; the Railway project, service and generated hostnames now consistently use CAPYN.

Hosted checks covered the four logical decisions, same-payload idempotency, conflicting-payload rejection, invalid credentials, agent-identity injection, denied execution, exact-request approval, approval replay, idempotent execution, least-privilege demo identity, Developer-plan metering and append-oriented audit output. They also covered all 22 public routes, all nine noindex dashboard routes, canonical and social metadata, JSON-LD, CSP, HSTS, robots, sitemap and the web manifest.

Railway's free-plan resource ceiling prevented a new project or second service. The authorized fallback stopped only the prior workload's compute and reconnected that service to CAPYN. Its existing volume and custom-domain records were preserved for recovery; no project, service, domain or volume was deleted.

## Hosting safety boundary

The Railway cutover may stop the prior workload's running compute only after CAPYN's public revision is green. Its persistent volume and custom domain remain intact so the stop is recoverable. Resource deletion is outside this checklist.

The hosted alpha remains a mock-execution developer demonstration. Stripe collection is available only when real provider credentials and price identifiers are supplied. Real settlement, production human identity, distributed rate limiting, provider reconciliation and the remaining controls in [Security](security.md) stay outside the public-alpha claim.
