# Project status

Reviewed 17 August 2026. This page distinguishes code completion from hosting, adoption and production authorization for real money.

## Completion boundary

| Milestone | Status | Meaning |
|---|---|---|
| Developer MVP | Complete | Policy engine, API, approvals, mock execution, audit, SDK, dashboard, seed and tests work locally. |
| Public-alpha code package | Complete | The public repository, website, documentation site, launch copy, reproducible video and platform-neutral hosting commands are present. |
| Public repository | Complete | Source and evidence are public at `github.com/meanstackofdoom/capyn`. |
| Hosted public alpha | Waiting on Railway capacity | Authentication succeeded, but Railway refused another project because the current free-plan resource limit is exhausted. Existing projects were not altered. |
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
- build and serve the public website and canonical documentation;
- reproduce the 24-second launch video and cover from checked-in Remotion source.

## Urgent public-alpha launch plan

The repository and launch assets are public. Remaining launch actions are deliberately small and evidence-led:

1. keep the full CI verification green on the tagged release (the public-alpha candidate is green);
2. upgrade the Railway plan or free one project slot with an explicit owner decision;
3. deploy separate web and API services plus managed PostgreSQL;
4. set the final domain, CORS origin and build-time public URLs;
5. verify the hosted four-scenario demo, approval path and audit trail;
6. add the hosted URL and Matthew's preferred public contact email to the outreach pack;
7. send the TechRadar briefing and publish “The Agent Authority Problem” as the first technical note;
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
