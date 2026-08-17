import { describe, expect, it } from "vitest";
import {
  createDemoRequest,
  evaluateDemoRequest,
  parseLabHandoff,
  serializeLabHandoff
} from "./demo-authority";

describe("public authority demo", () => {
  it("allows a granted request inside every limit", () => {
    const result = evaluateDemoRequest("compute", "approved", 18);
    expect(result.decision).toBe("ALLOW");
    expect(result.reason).toBe("ALL_HARD_RULES_PASS");
    expect(result.rules.every((rule) => rule.state === "pass")).toBe(true);
  });

  it("routes a soft-threshold request to a human", () => {
    const result = evaluateDemoRequest("compute", "approved", 120);
    expect(result.decision).toBe("REQUIRE_APPROVAL");
    expect(result.rules.at(-1)?.state).toBe("review");
  });

  it("denies a request above the hard limit and skips approval", () => {
    const result = evaluateDemoRequest("api", "approved", 175);
    expect(result.reason).toBe("HARD_LIMIT_EXCEEDED");
    expect(result.rules.find((rule) => rule.key === "hard")?.state).toBe("fail");
    expect(result.rules.find((rule) => rule.key === "approval")?.state).toBe("skipped");
  });

  it("fails closed for a blocked vendor", () => {
    const result = evaluateDemoRequest("compute", "blocked", 18);
    expect(result.reason).toBe("VENDOR_NOT_ALLOWED");
    expect(result.rules.find((rule) => rule.key === "vendor")?.state).toBe("fail");
  });

  it("stops at capability before downstream checks", () => {
    const result = evaluateDemoRequest("wallet", "approved", 30);
    expect(result.reason).toBe("CAPABILITY_NOT_GRANTED");
    expect(result.rules.map((rule) => rule.state)).toEqual(["pass", "fail", "skipped", "skipped", "skipped"]);
  });
});

describe("Authority Lab handoff", () => {
  it("round-trips a validated homepage request", () => {
    const request = createDemoRequest("api", "approved", 45);
    const parsed = parseLabHandoff(serializeLabHandoff(request, "homepage"));
    expect(parsed).toEqual({ request, source: "homepage" });
  });

  it("normalizes a shared amount to two decimals", () => {
    const parsed = parseLabHandoff("capability=spend.compute&vendor=openai&amount=18&purpose=Inference+capacity&source=shared");
    expect(parsed?.request.amount.value).toBe("18.00");
    expect(parsed?.source).toBe("shared");
  });

  it("rejects unknown capabilities, vendors, and malformed amounts", () => {
    expect(parseLabHandoff("capability=delete.production&vendor=openai&amount=18&purpose=Bad+request")).toBeNull();
    expect(parseLabHandoff("capability=spend.compute&vendor=unknown&amount=18&purpose=Bad+request")).toBeNull();
    expect(parseLabHandoff("capability=spend.compute&vendor=openai&amount=18USD&purpose=Bad+request")).toBeNull();
  });
});
