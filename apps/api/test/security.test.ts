import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { AuthorizationResult } from "@capyn/types";
import { agentHeaders, allowedRequest, createTestContext, ownerHeaders } from "./helpers";

const openApps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

async function setup() {
  const context = await createTestContext();
  openApps.push(context.app);
  return context;
}

describe("CAPYN security boundaries", () => {
  it("does not accept a client-supplied agent identity", async () => {
    const { app } = await setup();
    const response = await app.inject({
      method: "POST",
      url: "/v1/authorize",
      headers: agentHeaders("impersonation-0001"),
      payload: { ...allowedRequest, agentId: "agt_someone_else" }
    });
    expect(response.statusCode).toBe(400);
  });

  it("does not execute a denied authorization", async () => {
    const { app } = await setup();
    const denied = await app.inject({
      method: "POST",
      url: "/v1/authorize",
      headers: agentHeaders("denied-execute-0001"),
      payload: { ...allowedRequest, vendor: { id: "unknown", name: "UnknownVendor" } }
    });
    const result = denied.json<AuthorizationResult>();
    expect(result.decision).toBe("DENY");
    const execution = await app.inject({
      method: "POST",
      url: `/v1/authorizations/${result.authorizationId}/execute`,
      headers: { authorization: agentHeaders("unused-key-0001").authorization }
    });
    expect(execution.statusCode).toBe(409);
    expect(execution.json<{ error: { code: string } }>().error.code).toBe("AUTHORIZATION_NOT_EXECUTABLE");
  });

  it("prevents replay of an approval decision", async () => {
    const { app } = await setup();
    const response = await app.inject({
      method: "POST",
      url: "/v1/authorize",
      headers: agentHeaders("approval-replay-0001"),
      payload: { ...allowedRequest, amount: { value: "120.00", currency: "USD" } }
    });
    const result = response.json<Extract<AuthorizationResult, { decision: "REQUIRE_APPROVAL" }>>();
    const url = `/v1/approvals/${result.approvalId}/decision`;
    expect(
      (await app.inject({ method: "POST", url, headers: ownerHeaders, payload: { decision: "APPROVE" } })).statusCode
    ).toBe(200);
    const replay = await app.inject({
      method: "POST",
      url,
      headers: ownerHeaders,
      payload: { decision: "REJECT" }
    });
    expect(replay.statusCode).toBe(409);
    expect(replay.json<{ error: { code: string } }>().error.code).toBe("APPROVAL_ALREADY_DECIDED");
  });

  it("denies requests after mandate revocation", async () => {
    const { app } = await setup();
    const revoke = await app.inject({
      method: "DELETE",
      url: "/v1/agents/agt_demo_procurement/mandate",
      headers: { "x-capyn-user-id": ownerHeaders["x-capyn-user-id"] }
    });
    expect(revoke.statusCode, revoke.body).toBe(204);
    const authorization = await app.inject({
      method: "POST",
      url: "/v1/authorize",
      headers: agentHeaders("revoked-mandate-0001"),
      payload: allowedRequest
    });
    expect(authorization.json<AuthorizationResult>()).toMatchObject({
      decision: "DENY",
      reasonCodes: expect.arrayContaining(["NO_ACTIVE_MANDATE"])
    });
  });

  it("serializes concurrent approvals so the daily cap cannot be bypassed", async () => {
    const { app } = await setup();
    const makeApproval = async (key: string) => {
      const response = await app.inject({
        method: "POST",
        url: "/v1/authorize",
        headers: agentHeaders(key),
        payload: { ...allowedRequest, amount: { value: "120.00", currency: "USD" }, vendor: { id: "aws" } }
      });
      return response.json<Extract<AuthorizationResult, { decision: "REQUIRE_APPROVAL" }>>().approvalId;
    };
    const firstId = await makeApproval("concurrent-one-0001");
    const secondId = await makeApproval("concurrent-two-0001");
    const responses = await Promise.all([
      app.inject({
        method: "POST",
        url: `/v1/approvals/${firstId}/decision`,
        headers: ownerHeaders,
        payload: { decision: "APPROVE" }
      }),
      app.inject({
        method: "POST",
        url: `/v1/approvals/${secondId}/decision`,
        headers: ownerHeaders,
        payload: { decision: "APPROVE" }
      })
    ]);
    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 409]);
  });

  it("reserves concurrent authorizations so parallel requests cannot overspend", async () => {
    const { app } = await setup();
    const mandate = await app.inject({
      method: "POST",
      url: "/v1/mandates",
      headers: ownerHeaders,
      payload: {
        agentId: "agt_demo_procurement",
        name: "Concurrent spend authority",
        capabilities: ["spend.compute"],
        allowedVendors: [{ id: "openai", name: "OpenAI" }],
        limits: {
          perTransaction: { value: "100.00", currency: "USD" },
          daily: { value: "100.00", currency: "USD" },
          monthly: { value: "1000.00", currency: "USD" },
          approvalAbove: { value: "100.00", currency: "USD" }
        },
        validUntil: "2026-09-30T00:00:00.000Z"
      }
    });
    expect(mandate.statusCode, mandate.body).toBe(201);

    const responses = await Promise.all(
      [1, 2, 3, 4].map((attempt) =>
        app.inject({
          method: "POST",
          url: "/v1/authorize",
          headers: agentHeaders(`parallel-spend-${attempt}-0001`),
          payload: { ...allowedRequest, amount: { value: "30.00", currency: "USD" } }
        })
      )
    );
    const results = responses.map((response) => response.json<AuthorizationResult>());

    expect(results.filter((result) => result.decision === "ALLOW")).toHaveLength(3);
    expect(results.filter((result) => result.decision === "DENY")).toHaveLength(1);
    expect(results.find((result) => result.decision === "DENY")?.reasonCodes).toContain(
      "DAILY_LIMIT_EXCEEDED"
    );
  });

  it("enforces organisation isolation for agents and approvers", async () => {
    const { app } = await setup();
    const organisation = await app.inject({
      method: "POST",
      url: "/v1/organisations",
      headers: {
        "x-capyn-bootstrap-token": "capyn-test-bootstrap-token-123456789",
        "content-type": "application/json"
      },
      payload: { name: "Other Corp", slug: "other-corp", owner: { name: "Other Owner", email: "owner@other.test" } }
    });
    const ownerId = organisation.json<{ ownerId: string }>().ownerId;
    const otherHeaders = { "x-capyn-user-id": ownerId, "content-type": "application/json" };
    const agent = await app.inject({
      method: "POST",
      url: "/v1/agents",
      headers: otherHeaders,
      payload: { name: "other-agent", slug: "other-agent" }
    });
    const created = agent.json<{ agent: { id: string }; credential: { apiKey: string } }>();
    await app.inject({
      method: "POST",
      url: "/v1/mandates",
      headers: otherHeaders,
      payload: {
        agentId: created.agent.id,
        name: "Other authority",
        capabilities: ["spend.compute"],
        allowedVendors: [{ id: "openai" }],
        limits: {
          perTransaction: { value: "150.00", currency: "USD" },
          daily: { value: "200.00", currency: "USD" },
          monthly: { value: "2000.00", currency: "USD" },
          approvalAbove: { value: "100.00", currency: "USD" }
        },
        validUntil: "2026-09-30T00:00:00.000Z"
      }
    });
    const otherAuth = await app.inject({
      method: "POST",
      url: "/v1/authorize",
      headers: {
        authorization: `Bearer ${created.credential.apiKey}`,
        "idempotency-key": "other-org-request-0001",
        "content-type": "application/json"
      },
      payload: { ...allowedRequest, amount: { value: "120.00", currency: "USD" } }
    });
    const otherResult = otherAuth.json<Extract<AuthorizationResult, { decision: "REQUIRE_APPROVAL" }>>();

    const crossAgent = await app.inject({
      method: "GET",
      url: `/v1/authorizations/${otherResult.authorizationId}`,
      headers: { authorization: agentHeaders("unused-key-0002").authorization }
    });
    expect(crossAgent.statusCode).toBe(404);

    const crossApprover = await app.inject({
      method: "POST",
      url: `/v1/approvals/${otherResult.approvalId}/decision`,
      headers: ownerHeaders,
      payload: { decision: "APPROVE" }
    });
    expect(crossApprover.statusCode).toBe(404);
  });
});
