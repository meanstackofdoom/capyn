import { describe, expect, it } from "vitest";
import {
  buildBillingOverview,
  canCreateActiveAgent,
  canRecordAuthorization,
  getEntitlementPlanId,
  PLAN_CATALOG
} from "../src/index";

const baseInput = {
  subscriptionStatus: "ACTIVE" as const,
  provider: "INTERNAL" as const,
  currentPeriodStart: new Date("2026-08-01T00:00:00.000Z"),
  currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z"),
  cancelAtPeriodEnd: false,
  checkoutAvailable: false,
  customerPortalAvailable: false
};

describe("CAPYN hosted plan economics", () => {
  it("keeps the policy engine and bounded Developer plan free", () => {
    const overview = buildBillingOverview({
      ...baseInput,
      planId: "DEVELOPER",
      usage: { authorizationDecisions: 100, approvalRequests: 8, activeAgents: 1, auditEvents: 300, integrationConnections: 0 }
    });
    expect(overview.basePriceCents).toBe(0);
    expect(overview.estimatedMonthlyCents).toBe(0);
    expect(PLAN_CATALOG.DEVELOPER.features).toContain("Mock execution");
  });

  it("applies Team overage in explicit billing units", () => {
    const overview = buildBillingOverview({
      ...baseInput,
      planId: "TEAM",
      usage: { authorizationDecisions: 101_001, approvalRequests: 500, activeAgents: 12, auditEvents: 50_000, integrationConnections: 4 }
    });
    expect(overview.basePriceCents).toBe(9_900);
    expect(overview.estimatedMonthlyCents).toBe(15_600);
    expect(overview.usage.find((line) => line.metric === "AUTHORIZATION_DECISION")?.projectedChargeCents).toBe(400);
    expect(overview.usage.find((line) => line.metric === "APPROVAL_REQUEST")?.projectedChargeCents).toBe(0);
  });

  it("uses lower Business overage rates at fleet volume", () => {
    const overview = buildBillingOverview({
      ...baseInput,
      planId: "BUSINESS",
      usage: { authorizationDecisions: 1_001_000, approvalRequests: 1_000, activeAgents: 51, auditEvents: 1_000_000, integrationConnections: 11 }
    });
    expect(overview.estimatedMonthlyCents).toBe(52_700);
  });

  it("hard-limits only the bounded free allowances", () => {
    expect(canRecordAuthorization("DEVELOPER", 9_999)).toBe(true);
    expect(canRecordAuthorization("DEVELOPER", 10_000)).toBe(false);
    expect(canRecordAuthorization("TEAM", 1_000_000)).toBe(true);
    expect(canCreateActiveAgent("DEVELOPER", 2)).toBe(true);
    expect(canCreateActiveAgent("DEVELOPER", 3)).toBe(false);
    expect(canCreateActiveAgent("BUSINESS", 500)).toBe(true);
  });

  it("fails non-paying subscription states back to bounded Developer entitlements", () => {
    expect(getEntitlementPlanId("TEAM", "ACTIVE")).toBe("TEAM");
    expect(getEntitlementPlanId("BUSINESS", "PAST_DUE")).toBe("BUSINESS");
    expect(getEntitlementPlanId("BUSINESS", "UNPAID")).toBe("DEVELOPER");
    expect(getEntitlementPlanId("TEAM", "PAUSED")).toBe("DEVELOPER");
    expect(getEntitlementPlanId("TEAM", "INCOMPLETE")).toBe("DEVELOPER");
  });
});
