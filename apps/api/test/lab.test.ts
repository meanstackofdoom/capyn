import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { LabEvaluationResult, LabResolutionResult } from "@capyn/types";
import { createTestContext, ownerHeaders, TEST_NOW } from "./helpers";

const openApps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

async function setup(clock?: () => Date) {
  const context = await createTestContext({ ...(clock ? { clock } : {}) });
  openApps.push(context.app);
  return context;
}

const request = {
  capability: "spend.compute",
  amount: { value: "18.00", currency: "USD" },
  vendor: { id: "openai", name: "OpenAI" },
  purpose: "Inference capacity for a customer workflow"
} as const;

describe("public Authority Lab", () => {
  it("evaluates a synthetic request with the production policy engine and no credentials", async () => {
    const { app } = await setup();
    const response = await app.inject({ method: "POST", url: "/v1/lab/evaluate", payload: request });
    expect(response.statusCode).toBe(200);
    expect(response.json<LabEvaluationResult>()).toMatchObject({
      mode: "SYNTHETIC",
      decision: "ALLOW",
      outcome: "SIMULATED_EXECUTION",
      approval: null,
      reasonCodes: expect.arrayContaining(["CAPABILITY_ALLOWED", "VENDOR_ALLOWED"])
    });
    expect(response.json<LabEvaluationResult>().trace.map((step) => step.rule)).toContain("approvalThreshold");
    expect(response.json<LabEvaluationResult>().evidence.digest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("fails closed for authority outside the fixed public mandate", async () => {
    const { app } = await setup();
    const response = await app.inject({
      method: "POST",
      url: "/v1/lab/evaluate",
      payload: { ...request, capability: "transfer.wallet", vendor: { id: "github", name: "GitHub" } }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json<LabEvaluationResult>()).toMatchObject({
      decision: "DENY",
      outcome: "STOPPED",
      reasonCodes: expect.arrayContaining(["CAPABILITY_NOT_GRANTED", "VENDOR_NOT_ALLOWED"])
    });
  });

  it("binds a one-use human decision to the exact pending request", async () => {
    const { app } = await setup();
    const evaluation = await app.inject({
      method: "POST",
      url: "/v1/lab/evaluate",
      payload: { ...request, amount: { value: "120.00", currency: "USD" }, vendor: { id: "aws", name: "AWS" } }
    });
    expect(evaluation.statusCode).toBe(202);
    const pending = evaluation.json<LabEvaluationResult>();
    expect(pending.decision).toBe("REQUIRE_APPROVAL");
    expect(pending.approval?.id).toBeTruthy();

    const resolution = await app.inject({
      method: "POST",
      url: `/v1/lab/approvals/${pending.approval!.id}`,
      payload: { decision: "APPROVE" }
    });
    expect(resolution.statusCode).toBe(200);
    expect(resolution.json<LabResolutionResult>()).toMatchObject({
      authorizationId: pending.authorizationId,
      resolution: "APPROVED",
      policyDecision: "ALLOW",
      outcome: "SIMULATED_EXECUTION",
      request: pending.request
    });

    const replay = await app.inject({
      method: "POST",
      url: `/v1/lab/approvals/${pending.approval!.id}`,
      payload: { decision: "REJECT" }
    });
    expect(replay.statusCode).toBe(409);
    expect(replay.json<{ error: { code: string } }>().error.code).toBe("LAB_APPROVAL_ALREADY_DECIDED");
  });

  it("keeps a human-rejected request stopped", async () => {
    const { app } = await setup();
    const evaluation = await app.inject({
      method: "POST",
      url: "/v1/lab/evaluate",
      payload: { ...request, amount: { value: "120.00", currency: "USD" }, vendor: { id: "aws", name: "AWS" } }
    });
    const pending = evaluation.json<LabEvaluationResult>();
    const resolution = await app.inject({
      method: "POST",
      url: `/v1/lab/approvals/${pending.approval!.id}`,
      payload: { decision: "REJECT" }
    });
    expect(resolution.statusCode).toBe(200);
    expect(resolution.json<LabResolutionResult>()).toMatchObject({
      authorizationId: pending.authorizationId,
      resolution: "REJECTED",
      policyDecision: "REQUIRE_APPROVAL",
      outcome: "STOPPED"
    });
    expect(resolution.json<LabResolutionResult>().evidence.events.map((event) => event.type)).toContain("REQUEST_STOPPED");
  });

  it("expires pending approvals and rejects malformed or injected fields", async () => {
    let now = new Date(TEST_NOW);
    const { app } = await setup(() => new Date(now));
    const evaluation = await app.inject({
      method: "POST",
      url: "/v1/lab/evaluate",
      payload: { ...request, amount: { value: "120.00", currency: "USD" } }
    });
    const pending = evaluation.json<LabEvaluationResult>();
    now = new Date(TEST_NOW.getTime() + 11 * 60 * 1_000);
    const expired = await app.inject({
      method: "POST",
      url: `/v1/lab/approvals/${pending.approval!.id}`,
      payload: { decision: "APPROVE" }
    });
    expect(expired.statusCode).toBe(410);
    expect(expired.json<{ error: { code: string } }>().error.code).toBe("LAB_APPROVAL_EXPIRED");

    const malformed = await app.inject({
      method: "POST",
      url: "/v1/lab/evaluate",
      payload: { ...request, agentId: "customer_agent" }
    });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.json<{ error: { code: string } }>().error.code).toBe("VALIDATION_ERROR");
  });

  it("does not alter the persisted demo dashboard", async () => {
    const { app } = await setup();
    const before = await app.inject({ method: "GET", url: "/v1/dashboard", headers: ownerHeaders });
    await app.inject({ method: "POST", url: "/v1/lab/evaluate", payload: request });
    const after = await app.inject({ method: "GET", url: "/v1/dashboard", headers: ownerHeaders });
    expect(after.json()).toEqual(before.json());
  });
});
