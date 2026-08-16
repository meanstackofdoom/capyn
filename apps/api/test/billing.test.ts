import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { BillingOverview } from "@capyn/types";
import type {
  BillingCheckoutInput,
  BillingPortalInput,
  BillingProvider,
  NormalizedBillingEvent
} from "../src/domain/billing-provider";
import { agentHeaders, allowedRequest, createTestContext, ownerHeaders, TEST_NOW } from "./helpers";

const openApps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

class TestBillingProvider implements BillingProvider {
  readonly name = "STRIPE" as const;
  readonly configured = true;
  checkoutInputs: BillingCheckoutInput[] = [];
  portalInputs: BillingPortalInput[] = [];
  nextEvent: NormalizedBillingEvent = {
    providerEventId: "evt_stripe_subscription_updated",
    eventType: "customer.subscription.updated",
    payloadHash: "a".repeat(64),
    subscriptionUpdate: {
      organisationId: "org_demo_acme",
      planId: "TEAM",
      status: "ACTIVE",
      provider: "STRIPE",
      providerCustomerId: "cus_capyn",
      providerSubscriptionId: "sub_capyn_team",
      currentPeriodStart: new Date("2026-08-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z"),
      cancelAtPeriodEnd: false
    }
  };

  async createCheckout(input: BillingCheckoutInput) {
    this.checkoutInputs.push(input);
    return { id: "cs_test_capyn", url: "https://checkout.stripe.test/capyn" };
  }

  async createPortal(input: BillingPortalInput) {
    this.portalInputs.push(input);
    return { id: "bps_test_capyn", url: "https://billing.stripe.test/capyn" };
  }

  async verifyWebhook(_payload: Buffer, signature: string): Promise<NormalizedBillingEvent> {
    if (signature !== "valid-signature") throw new Error("invalid signature");
    return structuredClone(this.nextEvent);
  }
}

async function setup(billingProvider?: BillingProvider) {
  const context = await createTestContext(billingProvider ? { billingProvider } : {});
  openApps.push(context.app);
  return context;
}

describe("CAPYN hosted billing", () => {
  it("returns organisation-scoped plan allowances and live usage", async () => {
    const { app } = await setup();
    const before = await app.inject({ method: "GET", url: "/v1/billing", headers: ownerHeaders });
    expect(before.statusCode).toBe(200);
    expect(before.json<BillingOverview>()).toMatchObject({
      planId: "DEVELOPER",
      basePriceCents: 0,
      checkoutAvailable: false,
      usage: expect.arrayContaining([
        expect.objectContaining({ metric: "ACTIVE_AGENT", used: 1, included: 3 }),
        expect.objectContaining({ metric: "AUTHORIZATION_DECISION", used: 0, included: 10_000 })
      ])
    });

    await app.inject({
      method: "POST",
      url: "/v1/authorize",
      headers: agentHeaders("billing-meter-0001"),
      payload: allowedRequest
    });
    await app.inject({
      method: "POST",
      url: "/v1/authorize",
      headers: agentHeaders("billing-meter-0001"),
      payload: allowedRequest
    });
    await app.inject({
      method: "POST",
      url: "/v1/authorize",
      headers: agentHeaders("billing-approval-0001"),
      payload: { ...allowedRequest, amount: { value: "120.00", currency: "USD" } }
    });
    const after = await app.inject({ method: "GET", url: "/v1/billing", headers: ownerHeaders });
    const usage = after.json<BillingOverview>().usage;
    expect(usage.find((line) => line.metric === "AUTHORIZATION_DECISION")?.used).toBe(2);
    expect(usage.find((line) => line.metric === "APPROVAL_REQUEST")?.used).toBe(1);
  });

  it("fails closed at the free hosted decision quota without double-counting a replay", async () => {
    const { app, repository } = await setup();
    await repository.transaction((tx) =>
      tx.recordBillingUsage({
        id: "use_test_free_quota",
        organisationId: "org_demo_acme",
        metric: "AUTHORIZATION_DECISION",
        quantity: "10000",
        sourceType: "QuotaFixture",
        sourceId: "free-period",
        occurredAt: TEST_NOW,
        metadata: {}
      })
    );
    const response = await app.inject({
      method: "POST",
      url: "/v1/authorize",
      headers: agentHeaders("quota-exhausted-0001"),
      payload: allowedRequest
    });
    expect(response.statusCode).toBe(402);
    expect(response.json<{ error: { code: string } }>().error.code).toBe("PLAN_LIMIT_REACHED");
    expect(repository.inspect().authorizations).toHaveLength(0);
  });

  it("enforces the free active-agent cap inside the creation transaction", async () => {
    const { app } = await setup();
    for (const suffix of ["two", "three"]) {
      const created = await app.inject({
        method: "POST",
        url: "/v1/agents",
        headers: ownerHeaders,
        payload: { name: `agent-${suffix}`, slug: `agent-${suffix}` }
      });
      expect(created.statusCode, created.body).toBe(201);
    }
    const blocked = await app.inject({
      method: "POST",
      url: "/v1/agents",
      headers: ownerHeaders,
      payload: { name: "agent-four", slug: "agent-four" }
    });
    expect(blocked.statusCode).toBe(402);
    expect(blocked.json<{ error: { code: string } }>().error.code).toBe("PLAN_LIMIT_REACHED");
  });

  it("creates hosted checkout only for billing administrators", async () => {
    const provider = new TestBillingProvider();
    const { app } = await setup(provider);
    const checkout = await app.inject({
      method: "POST",
      url: "/v1/billing/checkout",
      headers: { ...ownerHeaders, "idempotency-key": "billing-checkout-team-0001" },
      payload: { planId: "TEAM" }
    });
    expect(checkout.statusCode, checkout.body).toBe(201);
    expect(checkout.json()).toMatchObject({ id: "cs_test_capyn", url: "https://checkout.stripe.test/capyn" });
    expect(provider.checkoutInputs[0]).toMatchObject({
      organisationId: "org_demo_acme",
      planId: "TEAM",
      idempotencyKey: "billing-checkout-team-0001"
    });

    const missingIdempotency = await app.inject({
      method: "POST",
      url: "/v1/billing/checkout",
      headers: ownerHeaders,
      payload: { planId: "TEAM" }
    });
    expect(missingIdempotency.statusCode).toBe(400);
    expect(missingIdempotency.json<{ error: { code: string } }>().error.code).toBe("IDEMPOTENCY_KEY_REQUIRED");

    const forbidden = await app.inject({
      method: "POST",
      url: "/v1/billing/checkout",
      headers: {
        "x-capyn-user-id": "usr_demo_approver",
        "content-type": "application/json",
        "idempotency-key": "billing-checkout-forbidden-0001"
      },
      payload: { planId: "BUSINESS" }
    });
    expect(forbidden.statusCode).toBe(403);
  });

  it("verifies and de-duplicates provider webhooks before changing an entitlement", async () => {
    const provider = new TestBillingProvider();
    const { app, repository } = await setup(provider);
    const invalid = await app.inject({
      method: "POST",
      url: "/v1/billing/webhooks/stripe",
      headers: { "content-type": "application/json", "stripe-signature": "invalid" },
      payload: "{}"
    });
    expect(invalid.statusCode).toBe(400);

    const deliver = () => app.inject({
      method: "POST",
      url: "/v1/billing/webhooks/stripe",
      headers: { "content-type": "application/json", "stripe-signature": "valid-signature" },
      payload: "{}"
    });
    expect((await deliver()).json()).toEqual({ received: true, duplicate: false });
    expect((await deliver()).json()).toEqual({ received: true, duplicate: true });
    expect(repository.inspect().subscriptions[0]).toMatchObject({ planId: "TEAM", provider: "STRIPE" });
    expect(repository.inspect().billingWebhookEvents).toHaveLength(1);

    provider.nextEvent = {
      ...provider.nextEvent,
      providerEventId: "evt_stripe_stale_subscription",
      payloadHash: "b".repeat(64),
      subscriptionUpdate: {
        ...provider.nextEvent.subscriptionUpdate!,
        planId: "DEVELOPER",
        status: "CANCELED",
        providerSubscriptionId: "sub_capyn_old"
      }
    };
    expect((await deliver()).json()).toEqual({ received: true, duplicate: false });
    expect(repository.inspect().subscriptions[0]).toMatchObject({
      planId: "TEAM",
      status: "ACTIVE",
      providerSubscriptionId: "sub_capyn_team"
    });
    expect(repository.inspect().auditEvents.some((event) => event.eventType === "SUBSCRIPTION_UPDATE_IGNORED"))
      .toBe(true);

    const duplicateSubscription = await app.inject({
      method: "POST",
      url: "/v1/billing/checkout",
      headers: { ...ownerHeaders, "idempotency-key": "billing-checkout-business-0001" },
      payload: { planId: "BUSINESS" }
    });
    expect(duplicateSubscription.statusCode).toBe(400);
    expect(duplicateSubscription.json<{ error: { code: string } }>().error.code).toBe(
      "BILLING_SUBSCRIPTION_EXISTS"
    );
  });

  it("creates a separate free billing account for a bootstrapped organisation", async () => {
    const { app } = await setup();
    const organisation = await app.inject({
      method: "POST",
      url: "/v1/organisations",
      headers: { "x-capyn-bootstrap-token": "capyn-test-bootstrap-token-123456789", "content-type": "application/json" },
      payload: { name: "Other Corp", slug: "billing-other", owner: { name: "Other Owner", email: "billing@other.test" } }
    });
    const ownerId = organisation.json<{ ownerId: string }>().ownerId;
    const billing = await app.inject({ method: "GET", url: "/v1/billing", headers: { "x-capyn-user-id": ownerId } });
    expect(billing.statusCode).toBe(200);
    expect(billing.json<BillingOverview>()).toMatchObject({ planId: "DEVELOPER" });
    expect(billing.json<BillingOverview>().usage.find((line) => line.metric === "ACTIVE_AGENT")?.used).toBe(0);
  });
});
