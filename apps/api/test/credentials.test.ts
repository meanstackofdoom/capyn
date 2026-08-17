import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { AgentPrincipal, AuthorizationResult, DashboardSnapshot } from "@capyn/types";
import { AuthorizationService } from "../src/domain/authorization-service";
import { ExecutionService } from "../src/domain/execution-service";
import {
  agentHeaders,
  allowedRequest,
  createTestContext,
  DEMO_KEY,
  ownerHeaders,
  TEST_NOW
} from "./helpers";

const openApps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

async function setup() {
  const context = await createTestContext();
  openApps.push(context.app);
  return context;
}

async function dashboard(app: FastifyInstance): Promise<DashboardSnapshot> {
  const response = await app.inject({ method: "GET", url: "/v1/dashboard", headers: ownerHeaders });
  expect(response.statusCode, response.body).toBe(200);
  return response.json<DashboardSnapshot>();
}

function adminHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { "x-capyn-user-id": ownerHeaders["x-capyn-user-id"], ...extra };
}

describe("agent credential lifecycle", () => {
  it("rotates one credential atomically and returns the same replacement on an idempotent retry", async () => {
    const { app } = await setup();
    const before = await dashboard(app);
    const source = before.agents[0]?.credentials.find((credential) => credential.status === "ACTIVE");
    expect(source).toBeDefined();

    const headers = adminHeaders({ "idempotency-key": "rotate-procurement-0001" });
    const path = `/v1/agents/agt_demo_procurement/credentials/${source!.id}/rotate`;
    const first = await app.inject({ method: "POST", url: path, headers });
    const replay = await app.inject({ method: "POST", url: path, headers });
    expect(first.statusCode, first.body).toBe(201);
    expect(replay.statusCode, replay.body).toBe(201);

    const replacement = first.json<{
      id: string;
      apiKey: string;
      keyPrefix: string;
      rotatedFromCredentialId: string;
    }>();
    expect(replay.json()).toEqual(replacement);
    expect(replacement.apiKey).toMatch(/^capyn_live_[A-Za-z0-9_-]{43}$/);
    expect(replacement.rotatedFromCredentialId).toBe(source!.id);

    const oldIdentity = await app.inject({
      method: "GET",
      url: "/v1/me",
      headers: { authorization: `Bearer ${DEMO_KEY}` }
    });
    const newIdentity = await app.inject({
      method: "GET",
      url: "/v1/me",
      headers: { authorization: `Bearer ${replacement.apiKey}` }
    });
    expect(oldIdentity.statusCode).toBe(401);
    expect(newIdentity.statusCode, newIdentity.body).toBe(200);

    const after = await dashboard(app);
    const agent = after.agents[0]!;
    expect(agent.credentials.filter((credential) => credential.status === "ACTIVE")).toHaveLength(1);
    expect(agent.credentials.find((credential) => credential.id === source!.id)?.status).toBe("REVOKED");
    expect(agent.credentials.find((credential) => credential.id === replacement.id)).toMatchObject({
      status: "ACTIVE",
      rotatedFromId: source!.id
    });
    expect(after.auditEvents.filter((event) => event.eventType === "API_KEY_ROTATED")).toHaveLength(1);
    expect(JSON.stringify(after)).not.toContain(replacement.apiKey);
  });

  it("requires a valid idempotency key and an owner or administrator", async () => {
    const { app } = await setup();
    const source = (await dashboard(app)).agents[0]!.credentials[0]!;
    const path = `/v1/agents/agt_demo_procurement/credentials/${source.id}/rotate`;

    const missing = await app.inject({ method: "POST", url: path, headers: adminHeaders() });
    const invalid = await app.inject({
      method: "POST",
      url: path,
      headers: adminHeaders({ "idempotency-key": "short" })
    });
    const approver = await app.inject({
      method: "POST",
      url: path,
      headers: { "x-capyn-user-id": "usr_demo_approver", "idempotency-key": "rotate-forbidden-0001" }
    });

    expect(missing.statusCode).toBe(400);
    expect(missing.json<{ error: { code: string } }>().error.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json<{ error: { code: string } }>().error.code).toBe("INVALID_IDEMPOTENCY_KEY");
    expect(approver.statusCode).toBe(403);
  });

  it("rejects idempotency reuse for another source credential", async () => {
    const { app } = await setup();
    const source = (await dashboard(app)).agents[0]!.credentials[0]!;
    const issued = await app.inject({
      method: "POST",
      url: "/v1/agents/agt_demo_procurement/credentials",
      headers: adminHeaders()
    });
    expect(issued.statusCode, issued.body).toBe(201);
    const otherCredentialId = issued.json<{ id: string }>().id;
    const headers = adminHeaders({ "idempotency-key": "rotation-conflict-0001" });

    expect((await app.inject({
      method: "POST",
      url: `/v1/agents/agt_demo_procurement/credentials/${source.id}/rotate`,
      headers
    })).statusCode).toBe(201);
    const conflict = await app.inject({
      method: "POST",
      url: `/v1/agents/agt_demo_procurement/credentials/${otherCredentialId}/rotate`,
      headers
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json<{ error: { code: string } }>().error.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("serializes competing rotations of the same credential", async () => {
    const { app } = await setup();
    const source = (await dashboard(app)).agents[0]!.credentials[0]!;
    const rotate = (key: string) => app.inject({
      method: "POST",
      url: `/v1/agents/agt_demo_procurement/credentials/${source.id}/rotate`,
      headers: adminHeaders({ "idempotency-key": key })
    });

    const responses = await Promise.all([
      rotate("rotation-race-first-0001"),
      rotate("rotation-race-second-0001")
    ]);
    expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 409]);
    expect(responses.find((response) => response.statusCode === 409)?.json<{ error: { code: string } }>().error.code)
      .toBe("CREDENTIAL_INACTIVE");
  });

  it("hides cross-organisation credentials", async () => {
    const { app } = await setup();
    const organisation = await app.inject({
      method: "POST",
      url: "/v1/organisations",
      headers: { "x-capyn-bootstrap-token": "capyn-test-bootstrap-token-123456789" },
      payload: { name: "Other Corp", slug: "credential-other", owner: { name: "Other Owner", email: "keys@other.test" } }
    });
    const ownerId = organisation.json<{ ownerId: string }>().ownerId;
    const created = await app.inject({
      method: "POST",
      url: "/v1/agents",
      headers: { "x-capyn-user-id": ownerId },
      payload: { name: "other-agent", slug: "credential-other-agent" }
    });
    const other = created.json<{ agent: { id: string }; credential: { id: string } }>();

    const response = await app.inject({
      method: "POST",
      url: `/v1/agents/${other.agent.id}/credentials/${other.credential.id}/rotate`,
      headers: adminHeaders({ "idempotency-key": "cross-tenant-rotation-0001" })
    });
    expect(response.statusCode).toBe(404);
  });

  it("revalidates a captured principal before authorization and execution", async () => {
    const { app, repository } = await setup();
    const authorization = await app.inject({
      method: "POST",
      url: "/v1/authorize",
      headers: agentHeaders("rotation-stale-execution-0001"),
      payload: allowedRequest
    });
    const authorizationId = authorization.json<AuthorizationResult>().authorizationId;
    const stalePrincipal: AgentPrincipal = {
      type: "AGENT",
      organisationId: "org_demo_acme",
      agentId: "agt_demo_procurement",
      credentialId: "key_demo_procurement"
    };
    const source = (await dashboard(app)).agents[0]!.credentials.find(
      (credential) => credential.id === stalePrincipal.credentialId
    )!;
    expect((await app.inject({
      method: "POST",
      url: `/v1/agents/agt_demo_procurement/credentials/${source.id}/rotate`,
      headers: adminHeaders({ "idempotency-key": "rotation-stale-principal-0001" })
    })).statusCode).toBe(201);

    const authorizations = new AuthorizationService(repository, () => new Date(TEST_NOW));
    const executions = new ExecutionService(repository, undefined, () => new Date(TEST_NOW));
    await expect(authorizations.authorize(stalePrincipal, allowedRequest, "stale-principal-auth-0001"))
      .rejects.toMatchObject({ statusCode: 401, code: "UNAUTHENTICATED" });
    await expect(executions.execute(stalePrincipal, authorizationId))
      .rejects.toMatchObject({ statusCode: 401, code: "UNAUTHENTICATED" });
  });
});
