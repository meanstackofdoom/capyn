import { describe, expect, it } from "vitest";
import type { PolicyEvaluationInput } from "@capyn/types";
import { evaluatePolicy } from "../src/index";

const base = (): PolicyEvaluationInput => ({
  now: "2026-08-16T10:00:00.000Z",
  agent: { id: "agt_1", status: "ACTIVE" },
  activeMandateCount: 1,
  mandate: {
    id: "man_1",
    name: "Procurement",
    version: 1,
    status: "ACTIVE",
    validFrom: "2026-08-01T00:00:00.000Z",
    validUntil: "2026-09-30T00:00:00.000Z",
    capabilities: ["spend.compute", "spend.api"],
    policy: {
      currency: "USD",
      allowedVendorIds: ["openai", "anthropic", "aws"],
      perTransactionLimitMinor: "15000",
      dailyLimitMinor: "20000",
      monthlyLimitMinor: "200000",
      approvalThresholdMinor: "10000"
    }
  },
  request: {
    capability: "spend.compute",
    amountMinor: "1800",
    currency: "USD",
    vendor: { id: "openai", name: "OpenAI" },
    metadata: {}
  },
  spend: { dailyMinor: "0", monthlyMinor: "0" },
  approvalAlreadyGranted: false
});

describe("evaluatePolicy", () => {
  it("allows a granted capability and approved vendor", () => {
    const result = evaluatePolicy(base());
    expect(result.decision).toBe("ALLOW");
    expect(result.reasonCodes).toContain("CAPABILITY_ALLOWED");
    expect(result.reasonCodes).toContain("VENDOR_ALLOWED");
  });

  it("denies an ungranted capability", () => {
    const input = base();
    input.request.capability = "transfer.wallet";
    expect(evaluatePolicy(input)).toMatchObject({
      decision: "DENY",
      reasonCodes: ["CAPABILITY_NOT_GRANTED"]
    });
  });

  it("denies an unknown vendor", () => {
    const input = base();
    input.request.vendor = { id: "unknown", name: "UnknownVendor" };
    expect(evaluatePolicy(input)).toMatchObject({ decision: "DENY", reasonCodes: ["VENDOR_NOT_ALLOWED"] });
  });

  it("denies an amount above the hard transaction limit", () => {
    const input = base();
    input.request.amountMinor = "15001";
    expect(evaluatePolicy(input).reasonCodes).toContain("TRANSACTION_LIMIT_EXCEEDED");
  });

  it("denies when projected daily spend exceeds the limit", () => {
    const input = base();
    input.spend.dailyMinor = "19000";
    expect(evaluatePolicy(input).reasonCodes).toContain("DAILY_LIMIT_EXCEEDED");
  });

  it("denies when projected monthly spend exceeds the limit", () => {
    const input = base();
    input.spend.monthlyMinor = "199000";
    expect(evaluatePolicy(input).reasonCodes).toContain("MONTHLY_LIMIT_EXCEEDED");
  });

  it("denies an expired mandate", () => {
    const input = base();
    input.now = "2026-10-01T00:00:00.000Z";
    expect(evaluatePolicy(input).reasonCodes).toContain("MANDATE_EXPIRED");
  });

  it("denies an inactive agent", () => {
    const input = base();
    input.agent.status = "SUSPENDED";
    expect(evaluatePolicy(input).reasonCodes).toContain("AGENT_INACTIVE");
  });

  it("requires approval above the configured threshold", () => {
    const input = base();
    input.request.amountMinor = "12000";
    expect(evaluatePolicy(input)).toMatchObject({
      decision: "REQUIRE_APPROVAL",
      reasonCodes: ["APPROVAL_THRESHOLD_EXCEEDED"]
    });
  });

  it("allows the exact request after approval while retaining hard rules", () => {
    const input = base();
    input.request.amountMinor = "12000";
    input.approvalAlreadyGranted = true;
    expect(evaluatePolicy(input).decision).toBe("ALLOW");
  });

  it("reports every independent hard-rule failure", () => {
    const input = base();
    input.request.capability = "transfer.wallet";
    input.request.vendor.id = "unknown";
    input.request.amountMinor = "50001";
    const result = evaluatePolicy(input);
    expect(result.decision).toBe("DENY");
    expect(result.reasonCodes).toEqual(
      expect.arrayContaining([
        "CAPABILITY_NOT_GRANTED",
        "VENDOR_NOT_ALLOWED",
        "TRANSACTION_LIMIT_EXCEEDED",
        "DAILY_LIMIT_EXCEEDED"
      ])
    );
  });

  it("fails closed for malformed policy money", () => {
    const input = base();
    input.mandate!.policy!.dailyLimitMinor = "not-money";
    expect(evaluatePolicy(input)).toMatchObject({
      decision: "DENY",
      reasonCodes: ["POLICY_CONFIGURATION_ERROR"]
    });
  });

  it("fails closed when multiple mandates are active", () => {
    const input = base();
    input.activeMandateCount = 2;
    expect(evaluatePolicy(input).reasonCodes).toEqual(["POLICY_CONFIGURATION_ERROR"]);
  });

  it("denies when no active mandate exists", () => {
    const input = base();
    input.activeMandateCount = 0;
    input.mandate = null;
    expect(evaluatePolicy(input).reasonCodes).toContain("NO_ACTIVE_MANDATE");
  });
});
