import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { AuthorizationResult, ExecutionResultView } from "@capyn/types";
import { agentHeaders, allowedRequest, createTestContext, DEMO_KEY, ownerHeaders, TEST_NOW } from "./helpers";

const openApps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

async function setup() {
  const context = await createTestContext();
  openApps.push(context.app);
  return context;
}

describe("CAPYN authorization API", () => {
  it("authorizes a valid agent request", async () => {
    const { app } = await setup();
    const response = await app.inject({
      method: "POST",
      url: "/v1/authorize",
      headers: agentHeaders("allow-request-0001"),
      payload: allowedRequest
    });
    expect(response.statusCode).toBe(200);
    expect(response.json<AuthorizationResult>()).toMatchObject({
      decision: "ALLOW",
      reasonCodes: expect.arrayContaining(["CAPABILITY_ALLOWED", "VENDOR_ALLOWED"])
    });
  });

  it("rejects invalid and revoked API keys", async () => {
    const { app, repository } = await setup();
    const invalid = await app.inject({
      method: "GET",
      url: "/v1/me",
      headers: { authorization: "Bearer capyn_invalid_key" }
    });
    expect(invalid.statusCode).toBe(401);

    await repository.transaction(async (tx) => {
      await tx.revokeCredential("key_demo_procurement", "agt_demo_procurement", TEST_NOW);
    });
    const revoked = await app.inject({
      method: "GET",
      url: "/v1/me",
      headers: { authorization: `Bearer ${DEMO_KEY}` }
    });
    expect(revoked.statusCode).toBe(401);
  });

  it("rejects malformed payloads", async () => {
    const { app } = await setup();
    const response = await app.inject({
      method: "POST",
      url: "/v1/authorize",
      headers: agentHeaders("malformed-req-0001"),
      payload: { ...allowedRequest, amount: { value: 18, currency: "USD" } }
    });
    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: { code: string } }>().error.code).toBe("VALIDATION_ERROR");
  });

  it("returns the same result for an idempotent replay and rejects conflicting payloads", async () => {
    const { app } = await setup();
    const first = await app.inject({
      method: "POST",
      url: "/v1/authorize",
      headers: agentHeaders("idempotent-key-0001"),
      payload: allowedRequest
    });
    const replay = await app.inject({
      method: "POST",
      url: "/v1/authorize",
      headers: agentHeaders("idempotent-key-0001"),
      payload: allowedRequest
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.json<AuthorizationResult>().authorizationId).toBe(
      first.json<AuthorizationResult>().authorizationId
    );

    const conflict = await app.inject({
      method: "POST",
      url: "/v1/authorize",
      headers: agentHeaders("idempotent-key-0001"),
      payload: { ...allowedRequest, amount: { value: "19.00", currency: "USD" } }
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json<{ error: { code: string } }>().error.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("supports exact-request approval, execution, and execution idempotency", async () => {
    const { app } = await setup();
    const authorization = await app.inject({
      method: "POST",
      url: "/v1/authorize",
      headers: agentHeaders("approval-flow-0001"),
      payload: {
        ...allowedRequest,
        amount: { value: "120.00", currency: "USD" },
        vendor: { id: "aws", name: "AWS" }
      }
    });
    expect(authorization.statusCode).toBe(202);
    const result = authorization.json<Extract<AuthorizationResult, { decision: "REQUIRE_APPROVAL" }>>();
    expect(result.decision).toBe("REQUIRE_APPROVAL");

    const approval = await app.inject({
      method: "POST",
      url: `/v1/approvals/${result.approvalId}/decision`,
      headers: ownerHeaders,
      payload: { decision: "APPROVE", comment: "Expected compute scale-up" }
    });
    expect(approval.statusCode).toBe(200);
    expect(approval.json<{ status: string }>().status).toBe("APPROVED");

    const execution = await app.inject({
      method: "POST",
      url: `/v1/authorizations/${result.authorizationId}/execute`,
      headers: { authorization: `Bearer ${DEMO_KEY}` }
    });
    expect(execution.statusCode).toBe(200);
    expect(execution.json<ExecutionResultView>().status).toBe("EXECUTED");

    const replay = await app.inject({
      method: "POST",
      url: `/v1/authorizations/${result.authorizationId}/execute`,
      headers: { authorization: `Bearer ${DEMO_KEY}` }
    });
    expect(replay.json<ExecutionResultView>().executionId).toBe(execution.json<ExecutionResultView>().executionId);
  });

  it("records authorization and approval events in the dashboard audit log", async () => {
    const { app } = await setup();
    await app.inject({
      method: "POST",
      url: "/v1/authorize",
      headers: agentHeaders("audit-request-0001"),
      payload: allowedRequest
    });
    const dashboard = await app.inject({ method: "GET", url: "/v1/dashboard", headers: ownerHeaders });
    expect(dashboard.statusCode).toBe(200);
    const body = dashboard.json<{ authorizations: unknown[]; auditEvents: Array<{ eventType: string }> }>();
    expect(body.authorizations).toHaveLength(1);
    expect(body.auditEvents.map((event) => event.eventType)).toContain("AUTHORIZATION_ALLOWED");
  });
});
