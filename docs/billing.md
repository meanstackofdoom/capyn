# Billing

CAPYN's open-source policy engine is free under the MIT licence. Hosted plans charge for operating the authority control plane around it: authorization volume, active agent identities, retained evidence, managed approvals, integrations and production service boundaries.

CAPYN does not charge a percentage of the value an agent spends. A `$10` request and a `$10,000` request each consume one authorization decision. The mandate—not the commercial plan—decides whether either request is allowed.

## Plan catalogue

Prices are monthly USD amounts before tax.

| Plan | Base | Active agents | Decisions / month | Hosted audit access | Integration connections |
|---|---:|---:|---:|---:|---:|
| Developer | $0 | 3 | 10,000 | 30 days | 0 |
| Team | $99 | 10 | 100,000 | 90 days | 3 |
| Business | $499 | 50 | 1,000,000 | 365 days | 10 |
| Enterprise | Contract | Contract | Contract | Contract | Contract |
| Design partner | $1,000–$2,500 | Scoped | Scoped | 365-day target | Scoped |

The `$499` Business row is implemented staging for entitlement, provider and webhook testing. It is not presented as a self-serve production offer during public alpha. Public production work requires a custom written scope covering the adapter, infrastructure and service boundary.

The Developer allowances are hard hosted limits. Team and Business remain available above included usage and calculate overage instead of interrupting authority decisions:

| Meter | Team overage | Business overage |
|---|---:|---:|
| Authorization decisions | $2 per started 1,000 | $1 per started 1,000 |
| Active agents | $12 per agent | $8 per agent |
| Integration connections | $29 per connection | $19 per connection |
| Approval requests | Included | Included |

Overage units round up. For example, 1,001 Team decisions above the included allowance produce two 1,000-decision units, or `$4`.

Approval requests are deliberately included. CAPYN must not create an economic incentive to replace `REQUIRE_APPROVAL` with weaker enforcement. Audit-event volume is visible but not charged per event.

## What is implemented

The current code includes:

- one persistent subscription record per organisation;
- append-only, source-bound usage events for authorization decisions and approval requests;
- live active-agent, approval and audit usage projections;
- organisation-level locking around free-plan quota checks;
- a pure, independently tested plan and overage calculator in `@capyn/billing`;
- `GET /v1/billing` for the current plan, usage and projected monthly amount;
- owner/admin-only, idempotent Stripe Checkout and customer-portal orchestration;
- raw-body Stripe signature verification;
- idempotent provider-event ingestion before subscription changes;
- current-subscription retrieval for create/update events and fail-closed rejection of obsolete subscription identifiers;
- redaction of Stripe signatures and payment credentials from application logs;
- pricing and billing interfaces that distinguish included, hard-limit, metered and contracted capacity.

Billing never changes a policy result. It can reject a new hosted request when the free organisation quota is exhausted, but it cannot convert `DENY` to `ALLOW`, bypass a mandate or make an authorization executable.

## Stripe configuration

Create monthly recurring base prices for Team and Business in Stripe, then configure all variables together:

```text
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_TEAM_MONTHLY=price_...
STRIPE_PRICE_BUSINESS_MONTHLY=price_...
```

If every variable is absent, CAPYN runs normally with internal Developer subscriptions and disables hosted checkout. If only some are present, the API refuses to start.

Configure Stripe to deliver these events to `/v1/billing/webhooks/stripe`:

```text
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
```

The webhook handler verifies the exact raw request body, records each provider/event-ID pair once, and updates the organisation subscription inside a serializable transaction. Create/update deliveries re-fetch the current subscription from Stripe rather than trusting a delayed snapshot. An event for a different obsolete subscription cannot overwrite a live provider subscription and is retained with an ignored-update audit event. Entitlements are derived from the configured Stripe base-price ID; inconsistent plan metadata fails closed. Active, trialing and past-due subscriptions retain the selected paid plan while provider retries run. Incomplete, unpaid, paused, deleted or canceled subscriptions fall back to Developer allowances while historical records remain intact.

Checkout is only used to create the first active paid subscription. Each request requires a caller idempotency key that CAPYN binds to the organisation and selected plan before passing a digest to Stripe. Once a provider subscription exists, CAPYN directs plan changes through the customer portal to avoid accidentally charging an organisation for duplicate subscriptions.

## Payment readiness boundary

Configured Checkout can collect the Team or Business base subscription now. The customer portal can manage a known Stripe customer, and webhook delivery synchronizes the local entitlement.

The usage ledger and projected overage model are implemented, but v0.3 does **not** yet publish those usage events to Stripe Billing meters or add them to an invoice. Paid overage therefore remains a transparent projection for manual reconciliation until a durable outbox/retry worker and Stripe meter configuration are added. This avoids claiming revenue that the payment provider has not actually invoiced.

Early design-partner fees are agreed and invoiced manually, beginning at `$1,000/month` for a scoped 8–12 week engagement. Production and Enterprise pricing require a written scope covering infrastructure, support, assurance, residency and deployment obligations.

## Entitlements versus shipped integrations

Plan language is a commercial entitlement, not permission to imply unfinished functionality:

- core request-bound approval exists on every plan; managed routing and advanced approval topology remain staged;
- plan retention describes a hosted access window, but alpha does not delete historical evidence on downgrade;
- outbound webhooks and payment/execution adapters remain production-gated integrations;
- SSO and SIEM export are Business entitlements but are not implemented in v0.3;
- dedicated infrastructure, private deployment, compliance commitments and SLAs exist only under an Enterprise agreement;
- CAPYN has no production certification today.

See [Security](security.md) for the authoritative production gate. Commercial delivery progress is maintained in the private status record.

## Accounting guarantees

- Authorization usage is written in the same database transaction as the decision.
- The authorization ID is the unique usage source, so an idempotent replay cannot be billed twice.
- The approval ID is the unique approval-usage source.
- Free-plan checks and increments share an organisation advisory lock, preventing parallel agents from trivially exceeding the monthly hosted allowance.
- Paid-plan overage is measured but does not weaken the mandate or interrupt the policy engine.
- Audit history is never silently deleted because a subscription changes.

Billing data remains tenant-scoped. Normal users cannot submit an organisation ID to read another account, and only owners/admins can create payment sessions.
