import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { SandboxActivationResult, SandboxEvaluationResult } from "@capyn/types";
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

const firstRequest = {
  capability: "spend.compute",
  amount: { value: "18.00", currency: "USD" },
  vendor: { id: "openai", name: "OpenAI" },
  purpose: "Inference capacity for a customer workflow"
} as const;

const activationRequest = {
  organisation: { name: "Northstar Systems" },
  agent: { name: "Nightly evaluation agent", slug: "nightly-evaluation-agent" },
  mandate: {
    name: "Nightly evaluation authority",
    capabilities: ["spend.compute"],
    allowedVendors: [{ id: "openai", name: "OpenAI" }],
    limits: {
      perTransaction: { value: "150.00", currency: "USD" },
      daily: { value: "200.00", currency: "USD" },
      monthly: { value: "2000.00", currency: "USD" },
      approvalAbove: { value: "100.00", currency: "USD" }
    }
  },
  firstRequest
} as const;

async function activate(app: FastifyInstance): Promise<SandboxActivationResult> {
  const response = await app.inject({
    method: "POST",
    url: "/v1/sandbox/activate",
    payload: activationRequest
  });
  expect(response.statusCode).toBe(201);
  return response.json<SandboxActivationResult>();
}

describe("stateless sandbox commissioning", () => {
  it("issues a short-lived opaque credential without changing persisted data", async () => {
    const { app } = await setup();
    const before = await app.inject({ method: "GET", url: "/v1/dashboard", headers: ownerHeaders });
    const result = await activate(app);
    const after = await app.inject({ method: "GET", url: "/v1/dashboard", headers: ownerHeaders });

    expect(result).toMatchObject({
      mode: "SYNTHETIC",
      scope: "STATELESS_SANDBOX",
      workspace: { name: "Northstar Systems" },
      agent: { slug: "nightly-evaluation-agent", status: "ACTIVE" },
      credential: { issuedAt: TEST_NOW.toISOString() }
    });
    expect(result.credential.apiKey).toMatch(/^capyn_sbx_[A-Za-z0-9_-]+$/);
    expect(result.credential.apiKey).not.toContain("Northstar");
    expect(result.credential.expiresAt).toBe(new Date(TEST_NOW.getTime() + 30 * 60 * 1_000).toISOString());
    expect(after.json()).toEqual(before.json());
  });

  it("authenticates the commissioned agent and runs the production policy engine", async () => {
    const { app } = await setup();
    const activation = await activate(app);
    const response = await app.inject({
      method: "POST",
      url: "/v1/sandbox/authorize",
      headers: { authorization: `Bearer ${activation.credential.apiKey}` },
      payload: firstRequest
    });
    const result = response.json<SandboxEvaluationResult>();

    expect(response.statusCode).toBe(200);
    expect(result).toMatchObject({
      mode: "SYNTHETIC",
      scope: "STATELESS_SANDBOX",
      agent: { name: "Nightly evaluation agent", slug: "nightly-evaluation-agent" },
      decision: "ALLOW",
      outcome: "SIMULATED_EXECUTION",
      reasonCodes: expect.arrayContaining(["CAPABILITY_ALLOWED", "VENDOR_ALLOWED"])
    });
    expect(result.trace.map((step) => step.rule)).toContain("approvalThreshold");
    expect(result.evidence.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(result.evidence.events[0]?.actor).toBe("Nightly evaluation agent");
  });

  it("stops disallowed vendors, opens human checkpoints, and enforces hard ceilings", async () => {
    const { app } = await setup();
    const activation = await activate(app);
    const headers = { authorization: `Bearer ${activation.credential.apiKey}` };

    const vendorDenied = await app.inject({
      method: "POST",
      url: "/v1/sandbox/authorize",
      headers,
      payload: { ...firstRequest, vendor: { id: "github", name: "GitHub" } }
    });
    expect(vendorDenied.json<SandboxEvaluationResult>()).toMatchObject({
      decision: "DENY",
      outcome: "STOPPED",
      reasonCodes: expect.arrayContaining(["VENDOR_NOT_ALLOWED"])
    });

    const approval = await app.inject({
      method: "POST",
      url: "/v1/sandbox/authorize",
      headers,
      payload: { ...firstRequest, amount: { value: "120.00", currency: "USD" } }
    });
    expect(approval.statusCode).toBe(202);
    expect(approval.json<SandboxEvaluationResult>()).toMatchObject({
      decision: "REQUIRE_APPROVAL",
      outcome: "HUMAN_CHECKPOINT"
    });

    const ceiling = await app.inject({
      method: "POST",
      url: "/v1/sandbox/authorize",
      headers,
      payload: { ...firstRequest, amount: { value: "151.00", currency: "USD" } }
    });
    expect(ceiling.json<SandboxEvaluationResult>()).toMatchObject({
      decision: "DENY",
      reasonCodes: expect.arrayContaining(["TRANSACTION_LIMIT_EXCEEDED"])
    });
  });

  it("rejects malformed, injected, and tampered credentials and payloads", async () => {
    const { app } = await setup();
    const activation = await activate(app);
    const attempts = [
      undefined,
      "Token wrong",
      "Bearer capyn_sbx_invalid",
      `Bearer ${activation.credential.apiKey.slice(0, -1)}A extra`
    ];

    for (const authorization of attempts) {
      const response = await app.inject({
        method: "POST",
        url: "/v1/sandbox/authorize",
        ...(authorization ? { headers: { authorization } } : {}),
        payload: firstRequest
      });
      expect(response.statusCode).toBe(401);
      expect(response.json<{ error: { code: string } }>().error.code).toBe("UNAUTHENTICATED");
    }

    const injected = await app.inject({
      method: "POST",
      url: "/v1/sandbox/authorize",
      headers: { authorization: `Bearer ${activation.credential.apiKey}` },
      payload: { ...firstRequest, agentId: "customer_agent" }
    });
    expect(injected.statusCode).toBe(400);
    expect(injected.json<{ error: { code: string } }>().error.code).toBe("VALIDATION_ERROR");
  });

  it("validates mandate boundaries at commissioning time", async () => {
    const { app } = await setup();
    const capability = await app.inject({
      method: "POST",
      url: "/v1/sandbox/activate",
      payload: { ...activationRequest, firstRequest: { ...firstRequest, capability: "transfer.wallet" } }
    });
    expect(capability.statusCode).toBe(400);
    expect(capability.json<{ error: { code: string } }>().error.code).toBe("SANDBOX_CAPABILITY_MISMATCH");

    const limits = await app.inject({
      method: "POST",
      url: "/v1/sandbox/activate",
      payload: {
        ...activationRequest,
        mandate: {
          ...activationRequest.mandate,
          limits: {
            ...activationRequest.mandate.limits,
            approvalAbove: { value: "160.00", currency: "USD" }
          }
        }
      }
    });
    expect(limits.statusCode).toBe(400);
    expect(limits.json<{ error: { code: string } }>().error.code).toBe("INVALID_LIMITS");
  });

  it("expires credentials after thirty minutes", async () => {
    let now = new Date(TEST_NOW);
    const { app } = await setup(() => new Date(now));
    const activation = await activate(app);
    now = new Date(TEST_NOW.getTime() + 31 * 60 * 1_000);
    const response = await app.inject({
      method: "POST",
      url: "/v1/sandbox/authorize",
      headers: { authorization: `Bearer ${activation.credential.apiKey}` },
      payload: firstRequest
    });
    expect(response.statusCode).toBe(410);
    expect(response.json<{ error: { code: string } }>().error.code).toBe("SANDBOX_CREDENTIAL_EXPIRED");
  });
});
