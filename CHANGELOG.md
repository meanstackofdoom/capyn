# Changelog

All notable CAPYN changes are recorded here. The project follows semantic version tags while the public alpha is evolving.

## Unreleased

### Hosted authority economics

- Added Developer, Team, Business, Enterprise and design-partner plan definitions.
- Added organisation subscriptions, source-bound usage events, hard free quotas and transparent paid overage projections.
- Added owner/admin Stripe Checkout and customer portal orchestration, request idempotency, raw-body signature verification and provider-scoped webhook replay protection.
- Re-fetch current Stripe subscription state and ignore obsolete subscription identifiers before entitlement changes.
- Added non-paying entitlement failback without allowing billing state to override policy decisions.

### Security and correctness

- Revalidate agent status, exact mandate binding and hard policy constraints immediately before execution.
- Revalidate the exact mandate binding before a human approval can grant authority.
- Serialize simultaneous decisions against the same approval request.
- Make agent revocation terminal and prevent replacement credentials.
- Add organisation-level quota locks, proxy-aware rate-limiting configuration and stronger billing database constraints.
- Add CSP, framing, MIME, permissions and HTTPS transport response controls to the public web service.

### Product and evidence

- Added public pricing, billing dashboard, accessible GSAP authority console and page-specific search/social metadata.
- Added billing and website documentation to the public documentation register.
- Added a repeatable production smoke harness covering the four seeded decisions, approval/execution, 22 public routes, nine dashboard routes, SEO boundaries and response headers.
- Added a tested one-service proxy adapter for a synthetic public alpha when a hosting account cannot provision the preferred split topology.
- Pinned Railway's native Railpack build/start/health contract so a reused service cannot inherit a Dockerfile builder.
- Launched and remotely verified the synthetic Railway public alpha while preserving the replaced service's volume and initially preserving its domain mapping for rollback.
- Aligned the Railway project, service, generated public hostname, private DNS name, canonical origins, documentation and outreach links to CAPYN.
- Detached the prior workload's custom domain from CAPYN after cutover so it cannot route visitors to the CAPYN application; the prior persistent volume remains untouched.
- Pinned production demo authentication to one explicit least-privilege approver and removed organisation-administration controls from the public control-plane build.

## v0.1.0 — 2026-08-16

- Published the first CAPYN developer MVP: policy engine, API, approvals, mock execution, audit evidence, SDK, dashboard, seeded demo, documentation and launch media.
