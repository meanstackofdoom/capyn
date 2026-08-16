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

  it("revalidates agent status immediately before execution", async () => {
    const { app } = await setup();
    const allowed = await app.inject({
      method: "POST",
      url: "/v1/authorize",
      headers: agentHeaders("suspend-before-execute-0001"),
      payload: allowedRequest
    });
    const result = allowed.json<AuthorizationResult>();
    expect(result.decision).toBe("ALLOW");
    expect((await app.inject({
      method: "PATCH",
      url: "/v1/agents/agt_demo_procurement/status",
      headers: ownerHeaders,
      payload: { status: "SUSPENDED" }
    })).statusCode).toBe(200);
    const execution = await app.inject({
      method: "POST",
      url: `/v1/authorizations/${result.authorizationId}/execute`,
      headers: { authorization: agentHeaders("unused-key-suspended").authorization }
    });
    expect(execution.statusCode).toBe(409);
    expect(execution.json<{ error: { code: string } }>().error.code).toBe("AUTHORIZATION_NO_LONGER_VALID");
  });

  it("invalidates an allowed authorization when its exact mandate is revoked", async () => {
    const { app } = await setup();
    const allowed = await app.inject({
      method: "POST",
      url: "/v1/authorize",
      headers: agentHeaders("revoke-before-execute-0001"),
      payload: allowedRequest
    });
    const result = allowed.json<AuthorizationResult>();
    expect(result.decision).toBe("ALLOW");
    expect((await app.inject({
      method: "DELETE",
      url: "/v1/agents/agt_demo_procurement/mandate",
      headers: { "x-capyn-user-id": ownerHeaders["x-capyn-user-id"] }
    })).statusCode).toBe(204);
    const execution = await app.inject({
      method: "POST",
      url: `/v1/authorizations/${result.authorizationId}/execute`,
      headers: { authorization: agentHeaders("unused-key-revoked-mandate").authorization }
    });
    expect(execution.statusCode).toBe(409);
    expect(execution.json<{ error: { code: string } }>().error.code).toBe("AUTHORIZATION_NO_LONGER_VALID");
  });

  it("does not approve an authorization after its exact mandate is replaced", async () => {
    const { app } = await setup();
    const pending = await app.inject({
      method: "POST",
      url: "/v1/authorize",
      headers: agentHeaders("replace-before-approval-0001"),
      payload: { ...allowedRequest, amount: { value: "120.00", currency: "USD" }, vendor: { id: "aws" } }
    });
    const result = pending.json<Extract<AuthorizationResult, { decision: "REQUIRE_APPROVAL" }>>();
    expect(result.decision).toBe("REQUIRE_APPROVAL");

    const replacement = await app.inject({
      method: "POST",
      url: "/v1/mandates",
      headers: ownerHeaders,
      payload: {
        agentId: "agt_demo_procurement",
        name: "Replacement authority",
        capabilities: ["spend.compute", "spend.api"],
        allowedVendors: [{ id: "openai" }, { id: "aws" }],
        limits: {
          perTransaction: { value: "150.00", currency: "USD" },
          daily: { value: "200.00", currency: "USD" },
          monthly: { value: "2000.00", currency: "USD" },
          approvalAbove: { value: "100.00", currency: "USD" }
        },
        validUntil: "2026-09-30T00:00:00.000Z"
      }
    });
    expect(replacement.statusCode, replacement.body).toBe(201);

    const approval = await app.inject({
      method: "POST",
      url: `/v1/approvals/${result.approvalId}/decision`,
      headers: ownerHeaders,
      payload: { decision: "APPROVE" }
    });
    expect(approval.statusCode).toBe(409);
    expect(approval.json<{ error: { code: string; message: string } }>().error).toMatchObject({
      code: "AUTHORIZATION_NO_LONGER_VALID"
    });
    expect(approval.json<{ error: { message: string } }>().error.message).toContain("AUTHORIZATION_MANDATE_CHANGED");
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

  it("serializes two simultaneous decisions for the same approval", async () => {
    const { app } = await setup();
    const response = await app.inject({
      method: "POST",
      url: "/v1/authorize",
      headers: agentHeaders("same-approval-race-0001"),
      payload: { ...allowedRequest, amount: { value: "120.00", currency: "USD" } }
    });
    const result = response.json<Extract<AuthorizationResult, { decision: "REQUIRE_APPROVAL" }>>();
    const decide = () => app.inject({
      method: "POST",
      url: `/v1/approvals/${result.approvalId}/decision`,
      headers: ownerHeaders,
      payload: { decision: "APPROVE" }
    });
    const decisions = await Promise.all([decide(), decide()]);
    expect(decisions.map((item) => item.statusCode).sort()).toEqual([200, 409]);
    expect(decisions.find((item) => item.statusCode === 409)?.json<{ error: { code: string } }>().error.code)
      .toBe("APPROVAL_ALREADY_DECIDED");
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

  it("treats agent revocation as terminal and refuses replacement credentials", async () => {
    const { app } = await setup();
    expect((await app.inject({
      method: "PATCH",
      url: "/v1/agents/agt_demo_procurement/status",
      headers: ownerHeaders,
      payload: { status: "REVOKED" }
    })).statusCode).toBe(200);
    const credential = await app.inject({
      method: "POST",
      url: "/v1/agents/agt_demo_procurement/credentials",
      headers: { "x-capyn-user-id": ownerHeaders["x-capyn-user-id"] }
    });
    expect(credential.statusCode).toBe(409);
    expect(credential.json<{ error: { code: string } }>().error.code).toBe("AGENT_REVOKED");
    const reactivate = await app.inject({
      method: "PATCH",
      url: "/v1/agents/agt_demo_procurement/status",
      headers: ownerHeaders,
      payload: { status: "ACTIVE" }
    });
    expect(reactivate.statusCode).toBe(409);
    expect(reactivate.json<{ error: { code: string } }>().error.code).toBe("AGENT_REVOKED");
    const mandate = await app.inject({
      method: "POST",
      url: "/v1/mandates",
      headers: ownerHeaders,
      payload: {
        agentId: "agt_demo_procurement",
        name: "Forbidden replacement mandate",
        capabilities: ["spend.compute"],
        allowedVendors: [{ id: "openai" }],
        limits: {
          perTransaction: { value: "50.00", currency: "USD" },
          daily: { value: "100.00", currency: "USD" },
          monthly: { value: "1000.00", currency: "USD" },
          approvalAbove: { value: "50.00", currency: "USD" }
        },
        validUntil: "2026-09-30T00:00:00.000Z"
      }
    });
    expect(mandate.statusCode).toBe(409);
    expect(mandate.json<{ error: { code: string } }>().error.code).toBe("AGENT_REVOKED");
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
