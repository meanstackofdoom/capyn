import { buildBillingOverview, getEntitlementPlanId, getPlanDefinition } from "@capyn/billing";
import type { CapynRepository } from "@capyn/database";
import type { BillingOverview, BillingPlanId, UserPrincipal } from "@capyn/types";
import {
  AuthorizationError,
  BillingUnavailableError,
  InvalidRequestError,
  NotFoundError
} from "../http/errors";
import type { BillingProvider } from "./billing-provider";
import { createId } from "./ids";

function ensureBillingAdministrator(principal: UserPrincipal): void {
  if (principal.role !== "OWNER" && principal.role !== "ADMIN") {
    throw new AuthorizationError("Only organisation owners and administrators can manage billing");
  }
}

const BILLING_IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/;

export class BillingService {
  constructor(
    private readonly repository: CapynRepository,
    private readonly provider: BillingProvider,
    private readonly publicAppUrl: string,
    private readonly clock: () => Date = () => new Date()
  ) {}

  async overview(principal: UserPrincipal): Promise<BillingOverview> {
    const account = await this.repository.getBillingAccount(principal.organisationId, this.clock());
    if (!account) throw new NotFoundError("Billing account not found");
    return buildBillingOverview({
      planId: getEntitlementPlanId(account.subscription.planId, account.subscription.status),
      subscriptionStatus: account.subscription.status,
      provider: account.subscription.provider,
      currentPeriodStart: account.subscription.currentPeriodStart,
      currentPeriodEnd: account.subscription.currentPeriodEnd,
      cancelAtPeriodEnd: account.subscription.cancelAtPeriodEnd,
      usage: {
        activeAgents: account.activeAgents,
        authorizationDecisions: account.authorizationDecisions,
        approvalRequests: account.approvalRequests,
        auditEvents: account.auditEvents,
        integrationConnections: account.integrationConnections
      },
      checkoutAvailable: this.provider.configured,
      customerPortalAvailable: this.provider.configured && Boolean(account.subscription.providerCustomerId)
    });
  }

  async createCheckout(
    principal: UserPrincipal,
    planId: "TEAM" | "BUSINESS",
    idempotencyKey: string
  ) {
    ensureBillingAdministrator(principal);
    if (!BILLING_IDEMPOTENCY_KEY.test(idempotencyKey)) {
      throw new InvalidRequestError(
        "INVALID_IDEMPOTENCY_KEY",
        "Idempotency-Key must contain 8-200 URL-safe characters"
      );
    }
    if (!this.provider.configured) throw new BillingUnavailableError();
    const plan = getPlanDefinition(planId);
    if (!plan.checkoutEligible) throw new InvalidRequestError("PLAN_NOT_CHECKOUT_ELIGIBLE", "This plan requires a sales agreement");
    const [account, user] = await Promise.all([
      this.repository.getBillingAccount(principal.organisationId, this.clock()),
      this.repository.findUser(principal.userId)
    ]);
    if (!account || !user || user.organisationId !== principal.organisationId) {
      throw new NotFoundError("Billing account not found");
    }
    if (
      account.subscription.providerSubscriptionId &&
      account.subscription.status !== "CANCELED"
    ) {
      throw new InvalidRequestError(
        "BILLING_SUBSCRIPTION_EXISTS",
        "Use the billing portal to change an existing hosted subscription"
      );
    }
    const session = await this.provider.createCheckout({
      organisationId: principal.organisationId,
      planId,
      customerId: account.subscription.providerCustomerId,
      customerEmail: user.email,
      successUrl: `${this.publicAppUrl}/dashboard/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${this.publicAppUrl}/dashboard/billing?checkout=canceled`,
      idempotencyKey
    });
    await this.repository.transaction((tx) =>
      tx.appendAudit({
        id: createId("evt"),
        organisationId: principal.organisationId,
        actorType: "USER",
        actorId: principal.userId,
        eventType: "BILLING_CHECKOUT_STARTED",
        entityType: "OrganisationSubscription",
        entityId: account.subscription.id,
        timestamp: this.clock(),
        metadata: { provider: this.provider.name, planId, checkoutSessionId: session.id }
      })
    );
    return session;
  }

  async createPortal(principal: UserPrincipal) {
    ensureBillingAdministrator(principal);
    if (!this.provider.configured) throw new BillingUnavailableError();
    const account = await this.repository.getBillingAccount(principal.organisationId, this.clock());
    if (!account?.subscription.providerCustomerId) {
      throw new InvalidRequestError("BILLING_CUSTOMER_REQUIRED", "Complete hosted checkout before opening the billing portal");
    }
    const session = await this.provider.createPortal({
      customerId: account.subscription.providerCustomerId,
      returnUrl: `${this.publicAppUrl}/dashboard/billing`
    });
    await this.repository.transaction((tx) =>
      tx.appendAudit({
        id: createId("evt"),
        organisationId: principal.organisationId,
        actorType: "USER",
        actorId: principal.userId,
        eventType: "BILLING_PORTAL_OPENED",
        entityType: "OrganisationSubscription",
        entityId: account.subscription.id,
        timestamp: this.clock(),
        metadata: { provider: this.provider.name, portalSessionId: session.id }
      })
    );
    return session;
  }

  async processWebhook(payload: Buffer, signature: string | undefined) {
    if (!this.provider.configured || this.provider.name !== "STRIPE") throw new BillingUnavailableError();
    if (!signature) throw new InvalidRequestError("INVALID_WEBHOOK_SIGNATURE", "A Stripe signature is required");
    let event;
    try {
      event = await this.provider.verifyWebhook(payload, signature);
    } catch {
      throw new InvalidRequestError("INVALID_WEBHOOK_SIGNATURE", "The Stripe webhook could not be verified");
    }
    const now = this.clock();
    return this.repository.transaction(async (tx) => {
      if (event.subscriptionUpdate) await tx.lockOrganisation(event.subscriptionUpdate.organisationId);
      const inserted = await tx.recordBillingWebhook({
        id: createId("bwh"),
        provider: "STRIPE",
        providerEventId: event.providerEventId,
        eventType: event.eventType,
        payloadHash: event.payloadHash,
        receivedAt: now,
        processedAt: now
      });
      if (!inserted) return { received: true, duplicate: true };
      if (event.subscriptionUpdate) {
        const previous = await tx.getBillingAllowance(event.subscriptionUpdate.organisationId, now);
        const currentSubscription = previous.subscription;
        const incomingSubscriptionId = event.subscriptionUpdate.providerSubscriptionId;
        if (
          currentSubscription.provider === "STRIPE" &&
          currentSubscription.providerSubscriptionId &&
          incomingSubscriptionId !== currentSubscription.providerSubscriptionId &&
          currentSubscription.status !== "CANCELED"
        ) {
          await tx.appendAudit({
            id: createId("evt"),
            organisationId: currentSubscription.organisationId,
            actorType: "SYSTEM",
            actorId: null,
            eventType: "SUBSCRIPTION_UPDATE_IGNORED",
            entityType: "OrganisationSubscription",
            entityId: currentSubscription.id,
            timestamp: now,
            metadata: {
              provider: "STRIPE",
              providerEventId: event.providerEventId,
              reason: "PROVIDER_SUBSCRIPTION_MISMATCH",
              incomingSubscriptionId
            }
          });
          return { received: true, duplicate: false };
        }
        const updated = await tx.updateSubscription(event.subscriptionUpdate);
        await tx.appendAudit({
          id: createId("evt"),
          organisationId: updated.organisationId,
          actorType: "SYSTEM",
          actorId: null,
          eventType: "SUBSCRIPTION_UPDATED",
          entityType: "OrganisationSubscription",
          entityId: updated.id,
          timestamp: now,
          metadata: {
            provider: "STRIPE",
            providerEventId: event.providerEventId,
            previousPlanId: previous.subscription.planId,
            planId: updated.planId,
            status: updated.status
          }
        });
      }
      return { received: true, duplicate: false };
    });
  }
}

export type CheckoutPlanId = Extract<BillingPlanId, "TEAM" | "BUSINESS">;
