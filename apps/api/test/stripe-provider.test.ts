import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { StripeBillingProvider } from "../src/domain/billing-provider";

function subscriptionPayload(input: {
  eventId: string;
  status: string;
  priceId: string;
  planId: string;
}) {
  return JSON.stringify({
    id: input.eventId,
    object: "event",
    type: "customer.subscription.updated",
    data: {
      object: {
        id: `sub_${input.eventId}`,
        object: "subscription",
        status: input.status,
        customer: "cus_capyn_signed",
        cancel_at_period_end: false,
        metadata: { capyn_organisation_id: "org_demo_acme", capyn_plan_id: input.planId },
        items: {
          data: [{
            id: `si_${input.eventId}`,
            price: { id: input.priceId },
            current_period_start: 1_754_006_400,
            current_period_end: 1_756_684_800
          }]
        }
      }
    }
  });
}

function parsedSubscription(payload: string): Stripe.Subscription {
  const parsed: unknown = JSON.parse(payload);
  return (parsed as { data: { object: Stripe.Subscription } }).data.object;
}

describe("Stripe billing provider", () => {
  it("verifies the raw payload and normalizes a request-bound subscription entitlement", async () => {
    const webhookSecret = "whsec_capyn_test_secret";
    const payload = JSON.stringify({
      id: "evt_capyn_signed",
      object: "event",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_capyn_signed",
          object: "subscription",
          status: "active",
          customer: "cus_capyn_signed",
          cancel_at_period_end: false,
          metadata: { capyn_organisation_id: "org_demo_acme", capyn_plan_id: "TEAM" },
          items: {
            data: [
              {
                id: "si_capyn_signed",
                price: { id: "price_team_capyn" },
                current_period_start: 1_754_006_400,
                current_period_end: 1_756_684_800
              }
            ]
          }
        }
      }
    });
    const stripeClient = new Stripe("sk_test_capyn");
    vi.spyOn(stripeClient.subscriptions, "retrieve").mockResolvedValue(
      parsedSubscription(payload) as Stripe.Response<Stripe.Subscription>
    );
    const provider = new StripeBillingProvider({
      secretKey: "sk_test_capyn",
      webhookSecret,
      teamPriceId: "price_team_capyn",
      businessPriceId: "price_business_capyn"
    }, stripeClient);
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });
    const event = await provider.verifyWebhook(Buffer.from(payload), signature);

    expect(event).toMatchObject({
      providerEventId: "evt_capyn_signed",
      eventType: "customer.subscription.updated",
      subscriptionUpdate: {
        organisationId: "org_demo_acme",
        planId: "TEAM",
        provider: "STRIPE",
        providerCustomerId: "cus_capyn_signed",
        providerSubscriptionId: "sub_capyn_signed"
      }
    });
    expect(event.payloadHash).toMatch(/^[a-f0-9]{64}$/);
    await expect(provider.verifyWebhook(Buffer.from(`${payload} `), signature)).rejects.toThrow();
  });

  it("derives entitlements from configured prices and fails non-paying states back to Developer", async () => {
    const webhookSecret = "whsec_capyn_test_secret";
    const mismatched = subscriptionPayload({
      eventId: "evt_plan_mismatch",
      status: "active",
      priceId: "price_team_capyn",
      planId: "BUSINESS"
    });
    const unpaid = subscriptionPayload({
      eventId: "evt_unpaid",
      status: "unpaid",
      priceId: "price_business_capyn",
      planId: "BUSINESS"
    });
    const subscriptions = new Map([
      ["sub_evt_plan_mismatch", parsedSubscription(mismatched)],
      ["sub_evt_unpaid", parsedSubscription(unpaid)]
    ]);
    const stripeClient = new Stripe("sk_test_capyn");
    vi.spyOn(stripeClient.subscriptions, "retrieve").mockImplementation(async (id) => {
      const subscription = subscriptions.get(id);
      if (!subscription) throw new Error("Unknown test subscription");
      return subscription as Stripe.Response<Stripe.Subscription>;
    });
    const provider = new StripeBillingProvider({
      secretKey: "sk_test_capyn",
      webhookSecret,
      teamPriceId: "price_team_capyn",
      businessPriceId: "price_business_capyn"
    }, stripeClient);
    const mismatchedSignature = Stripe.webhooks.generateTestHeaderString({ payload: mismatched, secret: webhookSecret });
    expect((await provider.verifyWebhook(Buffer.from(mismatched), mismatchedSignature)).subscriptionUpdate).toBeNull();

    const unpaidSignature = Stripe.webhooks.generateTestHeaderString({ payload: unpaid, secret: webhookSecret });
    expect((await provider.verifyWebhook(Buffer.from(unpaid), unpaidSignature)).subscriptionUpdate).toMatchObject({
      planId: "DEVELOPER",
      status: "UNPAID"
    });
  });
});
