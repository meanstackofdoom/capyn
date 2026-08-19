# Changelog

All notable CAPYN changes are recorded here. The project follows semantic version tags while the public alpha is evolving.

## Unreleased

### Deployable execution Gate

- Added `@capyn/gate`, a narrow MIT-licensed package for short-lived ES256 execution claims, exact-action verification and injected atomic replay storage.
- Bound each claim to the organisation, agent, mandate, authorization, execution, leased attempt, operation and canonical request fingerprint.
- Added separate `EXECUTE` and `RECONCILE` claims so recovery cannot reopen the original provider operation.
- Refactored execution behind one `ExecutionGateway` call so a remote Gate owns both claim consumption and provider invocation; the control API no longer verifies remotely and then calls a provider locally.
- Added an authenticated Fastify Gate service, strict HTTP client, request-matched Gate receipts and conservative ambiguous-transport handling.
- Added optional shared-secret HMAC-SHA-256 receipt signing between the Gate and control plane; when configured, unsigned, malformed or tampered receipts fail closed.
- Added a namespaced PostgreSQL claim-consumption table and atomic unique-key replay store shared across Gate replicas; production Gate configuration refuses in-memory replay.
- Added persistent P-256 PEM/key-ID configuration with overlapping public verification keys and fail-closed partial configuration.
- Added a fixed AWS EC2 dry-run blueprint adapter that rejects arbitrary operations, extra metadata, unknown blueprints, region drift and projected-cost drift. It deliberately performs no AWS network call and cannot create resources.
- Added adversarial package, database, Gate-service and API tests for action drift, signature tampering, expiry, audience isolation, concurrent replay, durable uniqueness, control authentication, receipt matching, receipt signing, reconciliation binding and the complete API-to-remote-Gate path.
- Documented the deliberately incomplete live boundary: KMS/HSM signing, an exclusive provider role, a reviewed real adapter, provider-native evidence, independently anchored receipts, outbox automation and alerting remain mandatory.

## v0.4.0 — 2026-08-18

### Durable workspace handoff

- Added a four-stage air-gap handoff from verified sandbox proof to a durable hosted-alpha workspace.
- Added atomic creation of the organisation, subscription, owner, imported agent, 30-day mandate, credential digests, launch claim and append-oriented audit evidence.
- Added one-claim-per-sandbox enforcement plus request-bound idempotency that recovers the same one-time credentials on an exact replay and rejects drift.
- Added a one-time recovery bundle with distinct owner-control-plane and agent-authorization credentials; only HMAC digests and short prefixes persist.
- Added scoped owner-key authentication for human APIs and a tab-scoped control-plane session without weakening the isolated public demo adapter.

### Commercial and interface boundary

- Connected Developer, Team and Business plan intent directly to onboarding while keeping Developer active until a signed billing webhook verifies a paid subscription.
- Made unconfigured Stripe state explicit: durable onboarding succeeds, records paid-plan intent and reports checkout as pending without claiming payment.
- Reworked public pricing around `$0` Developer, `$99` Team, `$499` Business and contracted live execution.
- Added an intentionally distinct transfer-rail launch interface, responsive key-custody locker, reduced-motion behavior and scoped GSAP transitions.

### Persistence and assurance

- Added Prisma models and migration coverage for owner credentials and production-launch replay records.
- Added API tests for atomic provisioning, authentication, plaintext-at-rest exclusion, audit creation, replay conflicts, tampering and billing handoff.
- Added browser utility tests for launch validation, normalized requests, masking and recovery exports.
- Added an atomic single-service volume journal for the constrained Railway topology, retained the managed-PostgreSQL migration path, and documented both persistence boundaries.

## v0.3.0 — 2026-08-18

### Authenticated sandbox commissioning

- Added a six-stage commissioning journey from ephemeral workspace and named agent through sealed mandate, expiring credential, real policy decision and portable proof.
- Added stateless `POST /v1/sandbox/activate` and `POST /v1/sandbox/authorize` endpoints with separate strict IP rate limits and injected-field rejection.
- Added versioned AES-256-GCM sandbox credentials, domain-separated from the deployment pepper, with authenticated payloads, generic tamper failures and a hard 30-minute expiry.
- Reused the deterministic production policy engine for all three outcomes while keeping repository state, billing, approvals, funds and execution adapters outside the public sandbox.
- Added a one-time masked credential instrument, in-memory-only handling, expiry countdown, credential-free curl output and explicit synthetic/no-persistence disclosures.

### Decision proof and product journey

- Connected commissioned agent names to canonical evidence events and retained strict actor bounds and control-character rejection in the proof parser.
- Added boundary stress tests for allow, human review and hard denial without changing the sealed credential or mandate.
- Added SHA-256 receipt display, copy/download controls and a direct handoff to the independent browser-side Proof Viewer.
- Made commissioning the primary public call to action and connected the homepage, developer guide, Mandate Studio, global navigation, footer and sitemap to the journey.
- Added a distinct instrument-bay visual system with an energized six-contact rail, live artifact register, responsive layouts and reduced-motion-safe GSAP reveals.

### Verification and documentation

- Added API coverage for stateless issuance, repository isolation, authenticated identity, all policy outcomes, malformed input, tampering and expiry.
- Added web coverage for commissioning validation, limit ordering, stable slugs, deterministic scenarios and secret-free integration output.
- Expanded separated and combined deployment smoke gates to commission an agent and verify its first digest-covered decision through built artifacts.
- Published the credential design, threat boundary, HTTP contract and deliberate stateless limitations in the public documentation register.

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
- Resolved the Windows development-server path traversal in transitive `esbuild` by pinning the workspace graph to 0.28.2.
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
