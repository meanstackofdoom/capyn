# Version 0.4 launch checklist

This is CAPYN's 20-gate release register for durable self-serve onboarding. A verified code gate means the repository contains the control and its automated evidence passed on 18 August 2026. It does not expand the hosted alpha's mock-execution boundary or claim readiness for real funds.

| # | Gate | Evidence | Status |
|---:|---|---|---|
| 1 | Verified source | Launch begins only from a valid, unexpired sandbox credential | Verified |
| 2 | One-way claim | A sandbox credential can commission only one durable workspace | Verified |
| 3 | Atomic tenant commit | Organisation, owner, agent, mandate, billing and audit records commit together | Verified |
| 4 | Scoped idempotency | Exact retries replay safely; drift conflicts; different callers cannot collide | Verified |
| 5 | Owner authentication | Tenant dashboard accepts hashed owner bearer credentials without demo fallback | Verified |
| 6 | Separate agent authentication | A distinct agent credential is issued for SDK and API calls | Verified |
| 7 | Secret-at-rest boundary | Plaintext owner and agent credentials are returned once and never persisted | Verified |
| 8 | Tenant dashboard | A launched owner sees only their organisation, agents, mandates and events | Verified |
| 9 | Custody gate | Recovery acknowledgement is required before entering the control plane | Verified |
| 10 | Persistence truth | UI and API report PostgreSQL, volume journal or process memory exactly as configured | Verified |
| 11 | Commercial rails | Developer, Team and Business prices and entitlements share one product contract | Verified |
| 12 | Billing honesty | Paid intent is recorded; activation waits for signed Stripe state | Verified |
| 13 | Demo isolation | The public Acme demonstration remains separate from commissioned tenants | Verified |
| 14 | Launch experience | Four-stage air-gap flow, clear state transitions and one-time recovery bundle | Verified |
| 15 | Accessibility | Labels, keyboard paths, reduced motion, contrast and responsive breakpoints reviewed | Verified |
| 16 | Durable adapters | Existing Railway volume journal is deployable; PostgreSQL schema and migration are ready | Verified |
| 17 | Automated coverage | API, web, database, policy, billing and SDK suites pass | Verified |
| 18 | Built-service smoke | Separate and combined production builds complete onboarding and authenticated reads | Verified |
| 19 | Public revision | Audited feature revision pushed and remote CI confirmed | Verified |
| 20 | Hosted persistence | Railway cutover, live onboarding and restart-survival verified | Verified |

## Commands

Run the complete repository gate:

```bash
corepack pnpm check
corepack pnpm audit --prod --audit-level high
corepack pnpm smoke:production
git diff --check
```

`smoke:production` starts the built API and web services temporarily on ports `4110` and `3110`, verifies the policy path, onboarding, owner authentication and public surfaces, then releases both ports. `smoke:combined` verifies the constrained one-service Railway adapter on three additional non-default ports. Neither requires Docker.

## Hosted evidence

Version 0.4 is live at [capyn-production.up.railway.app](https://capyn-production.up.railway.app). Feature revision `a8fc2ce` passed the complete remote CI gate and deployed successfully as Railway deployment `0a3d6607-73c6-4685-995a-a1eddd3360dc` on 18 August 2026.

Hosted verification commissioned a fresh sandbox identity, received an `ALLOW` decision, atomically created a durable Developer workspace, issued separate owner and agent credentials, and recovered the exact response on an idempotent replay. The service reported `VOLUME_JOURNAL`; after a deliberate Railway restart, the same unprinted owner and agent credentials still resolved the same tenant and identities. Browser review also covered the homepage, commissioning, pricing and locked private-status surfaces with no CAPYN application errors.

Railway's current plan rejected a new managed PostgreSQL service. Version 0.4 therefore targets the existing attached volume through the fail-closed single-service journal while retaining the PostgreSQL adapter and migration as the scale-out path. This constraint is reported in the product and does not weaken the one-time credential or tenant-isolation boundaries.

## Hosting safety boundary

The Railway cutover may restart CAPYN only after its public revision is green. The attached volume remains intact and CAPYN writes only beneath `/data/capyn/`. Project, service and volume deletion remain outside this checklist.

The hosted alpha remains a mock-execution developer demonstration. Stripe collection is available only when real provider credentials and price identifiers are supplied. Real settlement, production human identity, distributed rate limiting, provider reconciliation and the remaining controls in [Security](security.md) stay outside the public-alpha claim.
