# Changelog

All notable CAPYN changes are recorded here. The project follows semantic version tags while the public alpha is evolving.

## Unreleased

No unreleased changes.

## v0.2.0 — 2026-08-18

### Portable authority

- Added Mandate Studio, a browser-local guided builder that turns one consequential action into an explicit authority draft and typed integration code.
- Added versioned Authority Passports that travel in URL fragments, validate locally and recompute a canonical SHA-256 integrity digest without activating authority.
- Added strict malformed, oversized, unsafe and tampered Passport failure modes plus a Studio issue/edit round trip.
- Added the live Authority Lab, delegated-envelope rehearsal, evidence flight recorder and a client-side proof viewer backed by the real deterministic evaluator.
- Added Boundary File 001, a replayable synthetic procurement case study that preserves the mock-execution boundary.

### Developer distribution

- Prepared `@capyn/types`, `@capyn/policy-engine` and `@capyn/sdk` as narrow MIT-licensed public npm packages with package-level documentation and archive controls.
- Added a package-publishing runbook that separates the owner-controlled npm scope/2FA step from the reproducible repository checks.
- Added copyable developer examples, a real repository quickstart and direct source discovery across the website.

### Supply-chain security

- Resolved `GHSA-ggr8-5vv4-36mx` by pinning Prisma's transitive `deepmerge-ts` dependency to the patched 8.0.0 release.
- Added a production-dependency audit to remote CI and weekly Dependabot groups for pnpm and GitHub Actions.

### Hosted authority economics

- Added Developer, Team, Business, Enterprise and design-partner plan definitions.
- Added organisation subscriptions, source-bound usage events, hard free quotas and transparent paid overage projections.
- Added owner/admin Stripe Checkout and customer portal orchestration, request idempotency, raw-body signature verification and provider-scoped webhook replay protection.
- Re-fetch current Stripe subscription state and ignore obsolete subscription identifiers before entitlement changes.
- Added non-paying entitlement failback without allowing billing state to override policy decisions.

### Security and correctness

- Added leased execution claims and request-driven provider reconciliation so ambiguous outcomes remain reserved and exact retries cannot issue a second payment.
- Added source-bound, idempotent agent credential rotation with atomic revocation, deterministic response recovery, tenant isolation, race serialization and audit evidence.
- Revalidate the authenticating credential inside authorization and execution transactions to close revocation timing races.
- Include public demo identity and management-boundary variables in web build cache fingerprints.
- Revalidate agent status, exact mandate binding and hard policy constraints immediately before execution.
- Revalidate the exact mandate binding before a human approval can grant authority.
- Serialize simultaneous decisions against the same approval request.
- Make agent revocation terminal and prevent replacement credentials.
- Add organisation-level quota locks, proxy-aware rate-limiting configuration and stronger billing database constraints.
- Add CSP, framing, MIME, permissions and HTTPS transport response controls to the public web service.

### Product and evidence

- Added public pricing, billing dashboard, accessible GSAP authority console and page-specific search/social metadata.
- Added billing and website documentation to the public documentation register.
- Expanded the repeatable production smoke harness to cover the four seeded decisions, approval/execution, 29 public routes, nine dashboard routes, portable artifacts, the private brief, SEO boundaries and response headers.
- Added a tested one-service proxy adapter for a synthetic public alpha when a hosting account cannot provision the preferred split topology.
- Pinned Railway's native Railpack build/start/health contract so a reused service cannot inherit a Dockerfile builder.
- Launched and remotely verified the synthetic Railway public alpha while preserving the replaced service's volume and initially preserving its domain mapping for rollback.
- Aligned the Railway project, service, generated public hostname, private DNS name, canonical origins, documentation and outreach links to CAPYN.
- Detached the prior workload's custom domain from CAPYN after cutover so it cannot route visitors to the CAPYN application; the prior persistent volume remains untouched.
- Pinned production demo authentication to one explicit least-privilege approver and removed organisation-administration controls from the public control-plane build.

## v0.1.0 — 2026-08-16

- Published the first CAPYN developer MVP: policy engine, API, approvals, mock execution, audit evidence, SDK, dashboard, seeded demo, documentation and launch media.
