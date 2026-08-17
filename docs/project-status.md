# Project status

Reviewed 17 August 2026. This page distinguishes code completion from hosting, adoption and production authorization for real money.

## Completion boundary

| Milestone | Status | Meaning |
|---|---|---|
| Developer MVP | Complete | Policy engine, API, approvals, mock execution, audit, SDK, dashboard, seed and tests work locally. |
| Public-alpha code package | Complete | The public repository, website, documentation site, launch copy, reproducible video and platform-neutral hosting commands are present. |
| Public repository | Complete | Source and evidence are public at `github.com/meanstackofdoom/capyn`. |
| Tagged public alpha | Complete | `v0.1.0` was cut from a green clean-clone CI run with the video, cover and selected policy trace attached. |
| Commercial control plane | Payment-ready base plans | Plan catalogue, quotas, usage ledger, pricing, Checkout/portal adapters and signed webhooks are implemented. Automated provider overage reporting remains explicit follow-up work. |
| Hosted public alpha | Live synthetic demo | The one-service, memory-backed Railway demo is live and verified at `capyn-production.up.railway.app`; it uses mock execution and disposable state only. |
| Real-money production | Not complete | Requires the security, identity, accounting, executor, operational and compliance work below. |

“Complete” in the repository means the developer/public-alpha artifact is coherent, testable and honest about its boundary. It does not mean CAPYN should control production funds today.

## What works now

- create organisations, users, agents and revocable hashed agent credentials;
- create versioned, time-bounded mandates with extensible capabilities;
- enforce vendor, transaction, UTC-day and calendar-month limits;
- return deterministic `ALLOW`, `DENY` or `REQUIRE_APPROVAL` decisions with reason codes and traces;
- bind approval to one exact request and prevent decision replay;
- serialize approval decisions so competing human actions cannot both win;
- revalidate current agent, exact mandate binding, capability, vendor and hard limits immediately before execution;
- claim one execution and simulate it through `MockPaymentExecutor`;
- serialize per-agent spend reservations so simultaneous requests cannot reuse the same budget;
- isolate organisations in agent and human access paths;
- make agent revocation terminal and prevent replacement credentials for revoked identities;
- record append-oriented audit events;
- enforce hosted Developer quotas, fail inactive subscriptions back to free entitlements, and project Team/Business usage and overage;
- collect recurring Team/Business base fees through Stripe Checkout when provider credentials are configured;
- bind Checkout retries to organisation-scoped idempotency keys and synchronize subscriptions through signed, idempotent Stripe webhooks;
- use the TypeScript SDK, REST API, dashboard and four-scenario demo;
- build and serve the public website and canonical documentation;
- publish page-specific canonical/social metadata, software JSON-LD, search directives, security headers and an accessible GSAP authority console;
- run a reusable production smoke harness across the API, all public routes, all dashboard routes, SEO boundaries and security headers;
- reproduce the 24-second launch video and cover from checked-in Remotion source.
- run the hosted public alpha through all four decisions, idempotency conflict handling, approval/execution replay checks, billing metering, audit evidence and 31 public/dashboard route checks.

## Urgent public-alpha launch plan

The repository, tagged release, CI evidence, launch assets and synthetic hosted demo are public. The next actions move from construction to distribution and design-partner learning:

1. choose CAPYN's final public domain and Matthew's preferred public contact address;
2. send the prepared TechRadar briefing and publish “The Agent Authority Problem” as the first technical note;
3. invite a small, named cohort of agent builders and capture concrete authority-policy failure cases;
4. recruit two or three paid design partners at `$250–$1,000/month` for close integration support;
5. provision the intended split web/API/PostgreSQL staging topology when Railway capacity permits;
6. connect Stripe test mode only after the final domain and production human-auth adapter are selected;
7. turn design-partner evidence into the durable integrations, operational controls and compliance work customers will pay for.

The exact release evidence and deployment handoff are maintained in the [Public alpha launch checklist](launch-checklist.md).

The live demo is [capyn-production.up.railway.app](https://capyn-production.up.railway.app). The Railway project, service and generated public/private hostnames are aligned to CAPYN. The previous service's volume and custom-domain records remain intact solely for recovery; CAPYN does not read that volume or advertise the prior domain. Do not enter customer data or enable real settlement in this topology.

## Required before real money

### Identity and administration

- production human identity adapter with SSO, MFA, secure sessions and offboarding;
- reviewed role and organisation membership lifecycle;
- API-key rotation workflow and secret-manager integration;
- controlled onboarding that replaces the bootstrap token route.

### Accounting and concurrency

- treasury-level reservation ledger across multiple agents;
- capture, release, expiry, refund, reversal and partial-settlement semantics;
- deliberate time attribution for reservations and captures;
- multi-currency policy only after currency conversion/risk semantics are defined.

### Execution

- one selected real executor with destination binding, provider idempotency and reconciliation;
- transactional outbox/worker and recovery for stuck `EXECUTING` records;
- provider simulation/validation and durable external references;
- adversarial integration tests against a sandbox or testnet.

### Operations and assurance

- distributed rate limiting and abuse/anomaly detection;
- metrics, alerts, incident response and reconciliation runbooks;
- encrypted backups with tested restore and disaster recovery;
- immutable audit export, retention policy and SIEM integration;
- SBOM, dependency scanning and patch policy;
- independent threat model, penetration review and remediation;
- legal/compliance review for the actual custody, payment and jurisdiction model.

### Commercial operations

- durable outbox/retry worker for Stripe Billing meter events;
- invoice reconciliation for authorization, agent and integration overage;
- tax, refund, cancellation, dunning and customer-support runbooks;
- implemented SSO/SIEM integrations before representing Business entitlements as shipped;
- written support and SLA terms before accepting Enterprise reliability obligations.

## Release rule

No marketing claim, approval action or hosting milestone may silently redefine the production gate. The [Security](security.md) document remains the authoritative checklist before real funds, and the [Deployment](deployment.md) guide labels the current hosted target as a developer demo/public alpha.
