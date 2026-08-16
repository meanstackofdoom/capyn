import { createHash } from "node:crypto";
import Stripe from "stripe";
import { getEntitlementPlanId } from "@capyn/billing";
import type {
  BillingPlanId,
  BillingProviderName,
  SubscriptionStatus
} from "@capyn/types";

export interface BillingCheckoutInput {
  organisationId: string;
  planId: "TEAM" | "BUSINESS";
  customerId: string | null;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
}

export interface BillingPortalInput {
  customerId: string;
  returnUrl: string;
}

export interface NormalizedSubscriptionUpdate {
  organisationId: string;
  planId: BillingPlanId;
  status: SubscriptionStatus;
  provider: BillingProviderName;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

export interface NormalizedBillingEvent {
  providerEventId: string;
  eventType: string;
  payloadHash: string;
  subscriptionUpdate: NormalizedSubscriptionUpdate | null;
}

export interface BillingProvider {
  readonly name: BillingProviderName;
  readonly configured: boolean;
  createCheckout(input: BillingCheckoutInput): Promise<{ id: string; url: string }>;
  createPortal(input: BillingPortalInput): Promise<{ id: string; url: string }>;
  verifyWebhook(payload: Buffer, signature: string): Promise<NormalizedBillingEvent>;
}

export class DisabledBillingProvider implements BillingProvider {
  readonly name = "INTERNAL" as const;
  readonly configured = false;

  async createCheckout(_input: BillingCheckoutInput): Promise<never> {
    throw new Error("Hosted checkout is not configured");
  }

  async createPortal(_input: BillingPortalInput): Promise<never> {
    throw new Error("The billing portal is not configured");
  }

  async verifyWebhook(_payload: Buffer, _signature: string): Promise<never> {
    throw new Error("Stripe webhooks are not configured");
  }
}

export interface StripeBillingProviderConfig {
  secretKey: string;
  webhookSecret: string;
  teamPriceId: string;
  businessPriceId: string;
}

function subscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "trialing":
      return "TRIALING";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
    case "incomplete_expired":
      return "CANCELED";
    case "incomplete":
      return "INCOMPLETE";
    case "unpaid":
      return "UNPAID";
    case "paused":
      return "PAUSED";
    default:
      return "INCOMPLETE";
  }
}

function identifier(value: string | { id: string } | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

export class StripeBillingProvider implements BillingProvider {
  readonly name = "STRIPE" as const;
  readonly configured = true;
  private readonly stripe: Stripe;
  private readonly prices: Record<"TEAM" | "BUSINESS", string>;

  constructor(private readonly config: StripeBillingProviderConfig, stripeClient?: Stripe) {
    this.stripe = stripeClient ?? new Stripe(config.secretKey);
    this.prices = { TEAM: config.teamPriceId, BUSINESS: config.businessPriceId };
  }

  async createCheckout(input: BillingCheckoutInput): Promise<{ id: string; url: string }> {
    const metadata = {
      capyn_organisation_id: input.organisationId,
      capyn_plan_id: input.planId
    };
    const session = await this.stripe.checkout.sessions.create(
      {
        mode: "subscription",
        client_reference_id: input.organisationId,
        ...(input.customerId ? { customer: input.customerId } : { customer_email: input.customerEmail }),
        line_items: [{ price: this.prices[input.planId], quantity: 1 }],
        allow_promotion_codes: true,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata,
        subscription_data: { metadata }
      },
      {
        idempotencyKey: createHash("sha256")
          .update(`capyn-checkout-v1\u0000${input.organisationId}\u0000${input.planId}\u0000${input.idempotencyKey}`)
          .digest("hex")
      }
    );
    if (!session.url) throw new Error("Stripe did not return a Checkout URL");
    return { id: session.id, url: session.url };
  }

  async createPortal(input: BillingPortalInput): Promise<{ id: string; url: string }> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: input.customerId,
      return_url: input.returnUrl
    });
    return { id: session.id, url: session.url };
  }

  async verifyWebhook(payload: Buffer, signature: string): Promise<NormalizedBillingEvent> {
    const event = this.stripe.webhooks.constructEvent(payload, signature, this.config.webhookSecret);
    let update: NormalizedSubscriptionUpdate | null = null;

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const subscriptionId = identifier(session.subscription);
      if (subscriptionId) {
        update = this.normalizeSubscription(await this.stripe.subscriptions.retrieve(subscriptionId), {
          organisationId: session.metadata?.capyn_organisation_id ?? session.client_reference_id,
          planId: session.metadata?.capyn_plan_id
        });
      }
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated"
    ) {
      const subscription = await this.stripe.subscriptions.retrieve(event.data.object.id);
      update = this.normalizeSubscription(subscription, {
        organisationId: event.data.object.metadata.capyn_organisation_id,
        planId: event.data.object.metadata.capyn_plan_id
      });
    } else if (event.type === "customer.subscription.deleted") {
      update = this.normalizeSubscription(event.data.object, {
        organisationId: event.data.object.metadata.capyn_organisation_id,
        planId: event.data.object.metadata.capyn_plan_id,
        forceDeveloper: true
      });
    }

    return {
      providerEventId: event.id,
      eventType: event.type,
      payloadHash: createHash("sha256").update(payload).digest("hex"),
      subscriptionUpdate: update
    };
  }

  private normalizeSubscription(
    subscription: Stripe.Subscription,
    hints: { organisationId: string | null | undefined; planId: string | null | undefined; forceDeveloper?: boolean }
  ): NormalizedSubscriptionUpdate | null {
    if (!hints.organisationId) return null;
    const matchedItems: Array<{ item: Stripe.SubscriptionItem; planId: "TEAM" | "BUSINESS" }> = [];
    for (const item of subscription.items.data) {
      if (item.price.id === this.prices.TEAM) matchedItems.push({ item, planId: "TEAM" });
      if (item.price.id === this.prices.BUSINESS) matchedItems.push({ item, planId: "BUSINESS" });
    }
    if (matchedItems.length !== 1) return null;
    const { item, planId: inferredPlan } = matchedItems[0]!;
    if (hints.planId && hints.planId !== "TEAM" && hints.planId !== "BUSINESS") return null;
    if (hints.planId && hints.planId !== inferredPlan) return null;
    const status = subscriptionStatus(subscription.status);
    const planId: BillingPlanId = hints.forceDeveloper
      ? "DEVELOPER"
      : getEntitlementPlanId(inferredPlan, status);
    return {
      organisationId: hints.organisationId,
      planId,
      status,
      provider: "STRIPE",
      providerCustomerId: identifier(subscription.customer),
      providerSubscriptionId: subscription.id,
      currentPeriodStart: new Date(item.current_period_start * 1_000),
      currentPeriodEnd: new Date(item.current_period_end * 1_000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    };
  }
}
