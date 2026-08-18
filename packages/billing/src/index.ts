import type {
  BillableMetric,
  BillingOverview,
  BillingPlanId,
  BillingProviderName,
  BillingUsageLine,
  SubscriptionStatus
} from "@capyn/types";

export interface PlanDefinition {
  id: BillingPlanId;
  name: string;
  audience: string;
  description: string;
  basePriceCents: number | null;
  priceRangeCents: readonly [number, number] | null;
  checkoutEligible: boolean;
  limits: {
    activeAgents: number | null;
    authorizationDecisions: number | null;
    auditRetentionDays: number | null;
    integrationConnections: number | null;
  };
  overages: {
    authorizationDecisions: { unitSize: number; unitPriceCents: number } | null;
    activeAgents: { unitSize: 1; unitPriceCents: number } | null;
    integrationConnections: { unitSize: 1; unitPriceCents: number } | null;
  };
  authorizationLimitMode: "HARD_LIMIT" | "METERED" | "CONTRACT";
  activeAgentLimitMode: "HARD_LIMIT" | "METERED" | "CONTRACT";
  approvalWorkflows: string;
  reliability: string;
  compliance: string;
  features: readonly string[];
}

export const PLAN_CATALOG = {
  DEVELOPER: {
    id: "DEVELOPER",
    name: "Developer",
    audience: "Experiments and open-source evaluation",
    description: "A bounded hosted environment for proving the authority flow before production.",
    basePriceCents: 0,
    priceRangeCents: null,
    checkoutEligible: false,
    limits: { activeAgents: 3, authorizationDecisions: 10_000, auditRetentionDays: 30, integrationConnections: 0 },
    overages: { authorizationDecisions: null, activeAgents: null, integrationConnections: null },
    authorizationLimitMode: "HARD_LIMIT",
    activeAgentLimitMode: "HARD_LIMIT",
    approvalWorkflows: "Core request-bound approvals",
    reliability: "Best-effort public alpha",
    compliance: "Security documentation and audit evidence",
    features: ["1 organisation", "3 active agents", "10,000 decisions / month", "30-day hosted audit access", "Mock execution"]
  },
  TEAM: {
    id: "TEAM",
    name: "Team",
    audience: "Agent teams moving into shared environments",
    description: "Managed authority, approvals and retained evidence with predictable included usage.",
    basePriceCents: 9_900,
    priceRangeCents: null,
    checkoutEligible: true,
    limits: { activeAgents: 10, authorizationDecisions: 100_000, auditRetentionDays: 90, integrationConnections: 3 },
    overages: {
      authorizationDecisions: { unitSize: 1_000, unitPriceCents: 200 },
      activeAgents: { unitSize: 1, unitPriceCents: 1_200 },
      integrationConnections: { unitSize: 1, unitPriceCents: 2_900 }
    },
    authorizationLimitMode: "METERED",
    activeAgentLimitMode: "METERED",
    approvalWorkflows: "Managed request-bound approvals",
    reliability: "Standard managed service",
    compliance: "90-day evidence retention",
    features: ["10 active agents", "100,000 decisions / month", "90-day hosted audit access", "Approval operations", "3 integration connections"]
  },
  BUSINESS: {
    id: "BUSINESS",
    name: "Business",
    audience: "Operational agent fleets with governance requirements",
    description: "Higher-volume authority with longer evidence retention and production support boundaries.",
    basePriceCents: 49_900,
    priceRangeCents: null,
    checkoutEligible: true,
    limits: { activeAgents: 50, authorizationDecisions: 1_000_000, auditRetentionDays: 365, integrationConnections: 10 },
    overages: {
      authorizationDecisions: { unitSize: 1_000, unitPriceCents: 100 },
      activeAgents: { unitSize: 1, unitPriceCents: 800 },
      integrationConnections: { unitSize: 1, unitPriceCents: 1_900 }
    },
    authorizationLimitMode: "METERED",
    activeAgentLimitMode: "METERED",
    approvalWorkflows: "Advanced approvals and operational routing",
    reliability: "Priority support boundary",
    compliance: "365-day evidence retention; SSO and SIEM entitlement",
    features: ["50 active agents", "1,000,000 decisions / month", "365-day hosted audit access", "Priority support", "10 integration connections"]
  },
  ENTERPRISE: {
    id: "ENTERPRISE",
    name: "Enterprise",
    audience: "Regulated and high-scale organisations",
    description: "Contracted capacity, deployment, support, residency and assurance requirements.",
    basePriceCents: null,
    priceRangeCents: null,
    checkoutEligible: false,
    limits: { activeAgents: null, authorizationDecisions: null, auditRetentionDays: null, integrationConnections: null },
    overages: { authorizationDecisions: null, activeAgents: null, integrationConnections: null },
    authorizationLimitMode: "CONTRACT",
    activeAgentLimitMode: "CONTRACT",
    approvalWorkflows: "Contracted approval topology",
    reliability: "Contracted SLA and dedicated options",
    compliance: "Contracted controls, residency and evidence export",
    features: ["Contracted scale", "Dedicated deployment options", "SLA and support", "Custom retention and residency", "Compliance integrations"]
  },
  DESIGN_PARTNER: {
    id: "DESIGN_PARTNER",
    name: "Design partner",
    audience: "Early teams shaping production integrations",
    description: "Founder-led implementation and architecture support while the hosted product matures.",
    basePriceCents: null,
    priceRangeCents: [100_000, 250_000],
    checkoutEligible: false,
    limits: { activeAgents: null, authorizationDecisions: null, auditRetentionDays: 365, integrationConnections: null },
    overages: { authorizationDecisions: null, activeAgents: null, integrationConnections: null },
    authorizationLimitMode: "CONTRACT",
    activeAgentLimitMode: "CONTRACT",
    approvalWorkflows: "Co-designed approval operations",
    reliability: "Founder-supported evaluation",
    compliance: "Explicit pilot boundary and evidence review",
    features: ["From $1,000 / month", "8–12 week scoped engagement", "Founder-led integration", "Architecture reviews", "No implied production certification"]
  }
} as const satisfies Record<BillingPlanId, PlanDefinition>;

export interface BillingUsageCounts {
  authorizationDecisions: number;
  approvalRequests: number;
  activeAgents: number;
  auditEvents: number;
  integrationConnections: number;
}

export interface BuildBillingOverviewInput {
  planId: BillingPlanId;
  subscriptionStatus: SubscriptionStatus;
  provider: BillingProviderName;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  usage: BillingUsageCounts;
  checkoutAvailable: boolean;
  customerPortalAvailable: boolean;
}

function usageLine(
  metric: BillableMetric,
  used: number,
  included: number | null,
  pricing: { unitSize: number; unitPriceCents: number } | null,
  enforcement: BillingUsageLine["enforcement"]
): BillingUsageLine {
  const overage = included === null ? 0 : Math.max(0, used - included);
  const projectedChargeCents = pricing ? Math.ceil(overage / pricing.unitSize) * pricing.unitPriceCents : 0;
  return {
    metric,
    used,
    included,
    overage,
    unitSize: pricing?.unitSize ?? null,
    unitPriceCents: pricing?.unitPriceCents ?? null,
    projectedChargeCents,
    enforcement
  };
}

export function buildBillingOverview(input: BuildBillingOverviewInput): BillingOverview {
  const plan = PLAN_CATALOG[input.planId];
  const usage: BillingUsageLine[] = [
    usageLine("AUTHORIZATION_DECISION", input.usage.authorizationDecisions, plan.limits.authorizationDecisions, plan.overages.authorizationDecisions, plan.authorizationLimitMode),
    usageLine("ACTIVE_AGENT", input.usage.activeAgents, plan.limits.activeAgents, plan.overages.activeAgents, plan.activeAgentLimitMode),
    usageLine("APPROVAL_REQUEST", input.usage.approvalRequests, null, null, "INCLUDED"),
    usageLine("AUDIT_EVENT", input.usage.auditEvents, null, null, "INCLUDED"),
    usageLine(
      "INTEGRATION_CONNECTION",
      input.usage.integrationConnections,
      plan.limits.integrationConnections,
      plan.overages.integrationConnections,
      plan.limits.integrationConnections === null ? "CONTRACT" : plan.overages.integrationConnections ? "METERED" : "HARD_LIMIT"
    )
  ];
  const estimatedMonthlyCents = plan.basePriceCents === null
    ? null
    : plan.basePriceCents + usage.reduce((sum, line) => sum + line.projectedChargeCents, 0);

  return {
    planId: plan.id,
    planName: plan.name,
    subscriptionStatus: input.subscriptionStatus,
    provider: input.provider,
    currency: "USD",
    basePriceCents: plan.basePriceCents,
    priceRangeCents: plan.priceRangeCents,
    estimatedMonthlyCents,
    currentPeriodStart: input.currentPeriodStart.toISOString(),
    currentPeriodEnd: input.currentPeriodEnd.toISOString(),
    cancelAtPeriodEnd: input.cancelAtPeriodEnd,
    auditRetentionDays: plan.limits.auditRetentionDays,
    approvalWorkflows: plan.approvalWorkflows,
    reliability: plan.reliability,
    compliance: plan.compliance,
    usage,
    checkoutAvailable: input.checkoutAvailable,
    customerPortalAvailable: input.customerPortalAvailable
  };
}

export function getPlanDefinition(planId: BillingPlanId): PlanDefinition {
  return PLAN_CATALOG[planId];
}

/**
 * Paid entitlements remain available while Stripe is actively retrying a
 * past-due invoice, but fail back to the bounded Developer plan for every
 * non-paying terminal or incomplete state.
 */
export function getEntitlementPlanId(
  planId: BillingPlanId,
  status: SubscriptionStatus
): BillingPlanId {
  if (planId === "DEVELOPER") return planId;
  return status === "ACTIVE" || status === "TRIALING" || status === "PAST_DUE"
    ? planId
    : "DEVELOPER";
}

export function canCreateActiveAgent(planId: BillingPlanId, currentActiveAgents: number): boolean {
  const plan = PLAN_CATALOG[planId];
  return plan.activeAgentLimitMode !== "HARD_LIMIT" || plan.limits.activeAgents === null || currentActiveAgents < plan.limits.activeAgents;
}

export function canRecordAuthorization(planId: BillingPlanId, decisionsThisPeriod: number): boolean {
  const plan = PLAN_CATALOG[planId];
  return plan.authorizationLimitMode !== "HARD_LIMIT" ||
    plan.limits.authorizationDecisions === null ||
    decisionsThisPeriod < plan.limits.authorizationDecisions;
}
