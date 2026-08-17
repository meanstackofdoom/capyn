import { describe, expect, it } from "vitest";
import {
  createMandateConfig,
  createMandateStudioDraft,
  createStudioDecisionSamples,
  createStudioLabHref,
  createStudioTypeScript,
  createStudioVendor,
  getMandateStudioStatus,
  isStudioStageValid,
  parseStoredMandateDraft,
  serializeStoredMandateDraft,
  validateMandateStudioDraft
} from "./mandate-studio";

describe("Mandate Studio draft", () => {
  it("starts with a complete, testable inference boundary", () => {
    const draft = createMandateStudioDraft();
    expect(validateMandateStudioDraft(draft)).toEqual({});
    expect(getMandateStudioStatus(draft)).toEqual({ status: "TESTABLE", completed: 3, total: 3 });
  });

  it("reports action errors without invalidating unrelated stage checks", () => {
    const draft = { ...createMandateStudioDraft(), agentName: "Bad Agent", purpose: "" };
    const errors = validateMandateStudioDraft(draft);
    expect(errors.agentName).toContain("lowercase agent slug");
    expect(errors.purpose).toContain("consequential action");
    expect(isStudioStageValid(draft, "action")).toBe(false);
    expect(isStudioStageValid(draft, "boundary")).toBe(true);
    expect(getMandateStudioStatus(draft).status).toBe("UNBOUND");
  });

  it("enforces approval, action, daily and monthly limit ordering", () => {
    const draft = createMandateStudioDraft();
    draft.limits = { perTransaction: "300.00", daily: "200.00", monthly: "150.00", approvalAbove: "400.00" };
    const errors = validateMandateStudioDraft(draft);
    expect(errors.approvalAbove).toContain("hard per-action");
    expect(errors.daily).toContain("maximum action");
    expect(errors.monthly).toContain("daily limit");
  });

  it("normalizes an editable vendor into a stable identifier", () => {
    expect(createStudioVendor("  Google Cloud Platform  ")).toEqual({ id: "google-cloud-platform", name: "Google Cloud Platform" });
    expect(createStudioVendor("   ")).toBeNull();
  });

  it("round-trips a versioned browser-local draft", () => {
    const draft = createMandateStudioDraft("software");
    const savedAt = "2026-08-18T00:00:00.000Z";
    expect(parseStoredMandateDraft(serializeStoredMandateDraft(draft, savedAt))).toEqual({ schemaVersion: 1, savedAt, draft });
  });

  it("rejects corrupt, unknown-version and structurally unsafe drafts", () => {
    expect(parseStoredMandateDraft("not-json")).toBeNull();
    expect(parseStoredMandateDraft(JSON.stringify({ schemaVersion: 2, savedAt: new Date().toISOString(), draft: {} }))).toBeNull();
    const unsafeDraft = createMandateStudioDraft();
    unsafeDraft.vendors = [{ id: "bad vendor id", name: "Bad" }];
    expect(parseStoredMandateDraft(serializeStoredMandateDraft(unsafeDraft))).toBeNull();
  });

  it("generates an explicit draft-only mandate payload", () => {
    const payload = createMandateConfig(createMandateStudioDraft());
    expect(payload.mode).toBe("DRAFT_ONLY");
    expect(payload.mandate.status).toBe("DRAFT");
    expect(payload.mandate.capabilities).toContain("spend.compute");
    expect(payload.mandate.limits.approvalAbove).toEqual({ value: "100.00", currency: "USD" });
  });

  it("generates tailored integration code without embedding a credential", () => {
    const code = createStudioTypeScript(createMandateStudioDraft("treasury"));
    expect(code).toContain('capability: "transfer.wallet"');
    expect(code).toContain("process.env.CAPYN_API_KEY");
    expect(code).not.toContain("capyn_live_");
  });

  it("derives allow, human and hard-stop samples from the chosen limits", () => {
    const samples = createStudioDecisionSamples(createMandateStudioDraft());
    expect(samples.map((sample) => sample.decision)).toEqual(["ALLOW", "REQUIRE_APPROVAL", "DENY"]);
    expect(samples.map((sample) => sample.amount)).toEqual(["50.00", "125.00", "165.00"]);
  });

  it("creates a public Lab rehearsal only for a supported vendor", () => {
    expect(createStudioLabHref(createMandateStudioDraft())).toContain("/lab?");
    const draft = createMandateStudioDraft();
    draft.vendors = [{ id: "custom-rail", name: "Custom Rail" }];
    expect(createStudioLabHref(draft)).toBeNull();
  });
});
