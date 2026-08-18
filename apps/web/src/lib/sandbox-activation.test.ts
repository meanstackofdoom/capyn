import { describe, expect, it } from "vitest";
import {
  createSandboxActivationRequest,
  createSandboxCurl,
  createSandboxDraft,
  createSandboxScenarios,
  isSandboxStageValid,
  slugifySandboxName,
  validateSandboxDraft
} from "./sandbox-activation";

describe("sandbox activation draft", () => {
  it("starts ready to commission an allowed first action", () => {
    const draft = createSandboxDraft();
    expect(validateSandboxDraft(draft)).toEqual({});
    expect(isSandboxStageValid(draft, "workspace")).toBe(true);
    expect(isSandboxStageValid(draft, "agent")).toBe(true);
    expect(isSandboxStageValid(draft, "mandate")).toBe(true);
    expect(createSandboxActivationRequest(draft).firstRequest.amount.value).toBe("18.00");
  });

  it("normalizes agent names into stable slugs", () => {
    expect(slugifySandboxName("  Nightly Evaluation Agent  ")).toBe("nightly-evaluation-agent");
    expect(slugifySandboxName("R&D / Buyer #2")).toBe("r-d-buyer-2");
  });

  it("enforces the human, hard, daily, and monthly ordering", () => {
    const draft = createSandboxDraft();
    draft.approvalAbove = "180.00";
    draft.daily = "140.00";
    draft.monthly = "120.00";
    const errors = validateSandboxDraft(draft);
    expect(errors.approvalAbove).toContain("human line");
    expect(errors.daily).toContain("daily limit");
    expect(errors.monthly).toContain("monthly limit");

    draft.approvalAbove = draft.perTransaction;
    expect(validateSandboxDraft(draft).approvalAbove).toContain("review remains reachable");
  });

  it("generates three deterministic boundary tests", () => {
    expect(createSandboxScenarios(createSandboxDraft())).toEqual([
      { id: "inside", label: "Inside boundary", expectation: "ALLOW", amount: "18.00" },
      { id: "human", label: "Cross human line", expectation: "REVIEW", amount: "125.00" },
      { id: "outside", label: "Cross hard ceiling", expectation: "DENY", amount: "165.00" }
    ]);
  });

  it("keeps credentials out of generated curl snippets", () => {
    const draft = createSandboxDraft();
    const code = createSandboxCurl("https://api.example.test", createSandboxActivationRequest(draft).firstRequest);
    expect(code).toContain("$CAPYN_SANDBOX_KEY");
    expect(code).toContain("/v1/sandbox/authorize");
    expect(code).not.toContain("capyn_sbx_");
  });
});
