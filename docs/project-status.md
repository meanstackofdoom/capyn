# Project status

Reviewed 17 August 2026. This page distinguishes code completion from hosting, adoption and production authorization for real money.

## Completion boundary

| Milestone | Status | Meaning |
|---|---|---|
| Developer MVP | Complete | Policy engine, API, approvals, mock execution, audit, SDK, dashboard, seed and tests work locally. |
| Public-alpha code package | Complete | Public website, documentation site, metadata, launch copy, demo and platform-neutral hosting commands are present. |
| Hosted public alpha | Awaiting founder action | Requires an approved hosting account, final public origin, repository visibility and launch assets. |
| Real-money production | Not complete | Requires the security, identity, accounting, executor, operational and compliance work below. |

“Complete” in the repository means the developer/public-alpha artifact is coherent, testable and honest about its boundary. It does not mean CAPYN should control production funds today.

## What works now

- create organisations, users, agents and revocable hashed agent credentials;
- create versioned, time-bounded mandates with extensible capabilities;
- enforce vendor, transaction, UTC-day and calendar-month limits;
- return deterministic `ALLOW`, `DENY` or `REQUIRE_APPROVAL` decisions with reason codes and traces;
- bind approval to one exact request and prevent decision replay;
- claim one execution and simulate it through `MockPaymentExecutor`;
- serialize per-agent spend reservations so simultaneous requests cannot reuse the same budget;
- isolate organisations in agent and human access paths;
- record append-oriented audit events;
- use the TypeScript SDK, REST API, dashboard and four-scenario demo;
- build and serve the public website and canonical documentation.

## Urgent public-alpha launch plan

Repository work is complete when the verification suite stays green. The remaining launch actions require the project owner or approved external accounts:

1. choose repository visibility and publish the reviewed commit;
2. deploy separate web and API services plus managed PostgreSQL;
3. set the final domain, CORS origin and build-time public URLs;
4. verify the hosted four-scenario demo and audit trail;
5. record one 20–30 second terminal/control-plane demonstration;
6. publish “The Agent Authority Problem” as the first technical note;
7. replace placeholders in the TechRadar outreach pack with public evidence URLs;
8. invite a small, named cohort of agent builders and collect failure cases.

Do not enable real settlement during this launch phase.

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

## Release rule

No marketing claim, approval action or hosting milestone may silently redefine the production gate. The [Security](security.md) document remains the authoritative checklist before real funds, and the [Deployment](deployment.md) guide labels the current hosted target as a developer demo/public alpha.
