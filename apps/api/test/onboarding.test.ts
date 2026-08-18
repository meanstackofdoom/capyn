import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { ProductionLaunchResult } from "@capyn/types";
import type {
  BillingCheckoutInput,
  BillingPortalInput,
  BillingProvider,
  NormalizedBillingEvent
} from "../src/domain/billing-provider";
import { createTestContext } from "./helpers";

const openApps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

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
  firstRequest: {
    capability: "spend.compute",
    amount: { value: "18.00", currency: "USD" },
    vendor: { id: "openai", name: "OpenAI" },
    purpose: "Inference capacity for a customer workflow"
  }
} as const;

const launchRequest = {
  organisation: { slug: "northstar-systems" },
  owner: { name: "Taylor Owner", email: "taylor@northstar.test" },
  planIntent: "DEVELOPER",
  acknowledgements: { keyCustody: true, syntheticExecution: true }
} as const;

class LaunchBillingProvider implements BillingProvider {
  readonly name = "STRIPE" as const;
  readonly configured = true;
  checkoutInputs: BillingCheckoutInput[] = [];

  async createCheckout(input: BillingCheckoutInput) {
    this.checkoutInputs.push(input);
    return { id: "cs_launch_team", url: "https://checkout.stripe.test/launch-team" };
  }

  async createPortal(_input: BillingPortalInput) {
    return { id: "bps_launch", url: "https://billing.stripe.test/launch" };
  }

  async verifyWebhook(_payload: Buffer, _signature: string): Promise<NormalizedBillingEvent> {
    throw new Error("Not used in onboarding tests");
  }
}

async function setup(billingProvider?: BillingProvider) {
  const context = await createTestContext(billingProvider ? { billingProvider } : {});
  openApps.push(context.app);
  return context;
}

async function activate(app: FastifyInstance): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/v1/sandbox/activate",
    payload: activationRequest
  });
  expect(response.statusCode, response.body).toBe(201);
  return response.json<{ credential: { apiKey: string } }>().credential.apiKey;
}

async function launch(
  app: FastifyInstance,
  sandboxKey: string,
  idempotencyKey = "launch-northstar-0001",
  payload: Record<string, unknown> = launchRequest
) {
  return app.inject({
    method: "POST",
    url: "/v1/onboarding/launch",
    headers: {
      authorization: `Bearer ${sandboxKey}`,
      "idempotency-key": idempotencyKey,
      "content-type": "application/json"
    },
    payload
  });
}

describe("durable production onboarding", () => {
  it("imports a sandbox boundary into one durable workspace and issues hashed owner and agent keys", async () => {
    const { app, repository } = await setup();
    const sandboxKey = await activate(app);
    const response = await launch(app, sandboxKey);
    const result = response.json<ProductionLaunchResult>();

    expect(response.statusCode, response.body).toBe(201);
    expect(result).toMatchObject({
      mode: "HOSTED_ALPHA",
      scope: "DURABLE_WORKSPACE",
      replayed: false,
      workspace: {
        name: "Northstar Systems",
        slug: "northstar-systems",
        persistence: "PROCESS_MEMORY"
      },
      owner: { name: "Taylor Owner", email: "taylor@northstar.test", role: "OWNER" },
      agent: { name: "Nightly evaluation agent", slug: "nightly-evaluation-agent", status: "ACTIVE" },
      mandate: { name: "Nightly evaluation authority", version: 1 },
      billing: { planIntent: "DEVELOPER", activePlan: "DEVELOPER", checkoutAvailable: false },
      handoff: { importedFrom: "STATELESS_SANDBOX", sandboxCredentialConsumed: true }
    });
    expect(result.credentials.owner.apiKey).toMatch(/^capyn_owner_live_[A-Za-z0-9_-]+$/);
    expect(result.credentials.agent.apiKey).toMatch(/^capyn_live_[A-Za-z0-9_-]+$/);

    const state = repository.inspect();
    expect(state.productionLaunches).toHaveLength(1);
    expect(state.userCredentials).toHaveLength(1);
    expect(state.userCredentials[0]?.keyHash).not.toContain(result.credentials.owner.apiKey);
    expect(state.credentials.find((item) => item.id === result.credentials.agent.id)?.keyHash)
      .not.toContain(result.credentials.agent.apiKey);

    const dashboard = await app.inject({
      method: "GET",
      url: "/v1/dashboard",
      headers: { authorization: `Bearer ${result.credentials.owner.apiKey}` }
    });
    expect(dashboard.statusCode, dashboard.body).toBe(200);
    expect(dashboard.json()).toMatchObject({
      organisation: { id: result.workspace.id, name: "Northstar Systems", slug: "northstar-systems" },
      operator: { id: result.owner.id, name: "Taylor Owner", role: "OWNER" },
      stats: { activeAgents: 1, activeMandates: 1 }
    });

    const agent = await app.inject({
      method: "GET",
      url: "/v1/me",
      headers: { authorization: `Bearer ${result.credentials.agent.apiKey}` }
    });
    expect(agent.statusCode, agent.body).toBe(200);
    expect(agent.json()).toMatchObject({ id: result.agent.id, organisationId: result.workspace.id });
    const bearerDoesNotFallBack = await app.inject({
      method: "GET",
      url: "/v1/dashboard",
      headers: {
        authorization: "Bearer capyn_owner_live_invalid-credential-material",
        "x-capyn-user-id": "usr_demo_owner"
      }
    });
    expect(bearerDoesNotFallBack.statusCode).toBe(401);
    expect(state.auditEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        "PRODUCTION_WORKSPACE_LAUNCHED",
        "OWNER_ACCESS_KEY_CREATED",
        "AGENT_CREATED",
        "API_KEY_CREATED",
        "MANDATE_ACTIVATED"
      ])
    );
  });

  it("replays the exact launch with the same credentials and rejects idempotency drift", async () => {
    const { app, repository } = await setup();
    const sandboxKey = await activate(app);
    const first = await launch(app, sandboxKey);
    const replay = await launch(app, sandboxKey);
    expect(first.statusCode).toBe(201);
    expect(replay.statusCode).toBe(200);
    expect(replay.json<ProductionLaunchResult>()).toMatchObject({
      replayed: true,
      workspace: { id: first.json<ProductionLaunchResult>().workspace.id },
      credentials: {
        owner: { apiKey: first.json<ProductionLaunchResult>().credentials.owner.apiKey },
        agent: { apiKey: first.json<ProductionLaunchResult>().credentials.agent.apiKey }
      }
    });
    expect(repository.inspect().productionLaunches).toHaveLength(1);

    const drift = await launch(app, sandboxKey, "launch-northstar-0001", {
      ...launchRequest,
      owner: { ...launchRequest.owner, name: "Different Owner" }
    });
    expect(drift.statusCode).toBe(409);
    expect(drift.json<{ error: { code: string } }>().error.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("allows one durable claim per sandbox credential", async () => {
    const { app } = await setup();
    const sandboxKey = await activate(app);
    expect((await launch(app, sandboxKey)).statusCode).toBe(201);
    const second = await launch(app, sandboxKey, "launch-northstar-0002", {
      ...launchRequest,
      organisation: { slug: "northstar-second" }
    });
    expect(second.statusCode).toBe(409);
    expect(second.json<{ error: { code: string } }>().error.code).toBe("SANDBOX_ALREADY_LAUNCHED");
  });

  it("scopes caller idempotency keys to the authenticated sandbox claim", async () => {
    const { app } = await setup();
    const firstSandbox = await activate(app);
    const secondSandbox = await activate(app);
    expect((await launch(app, firstSandbox, "shared-caller-key-0001")).statusCode).toBe(201);
    const second = await launch(app, secondSandbox, "shared-caller-key-0001", {
      ...launchRequest,
      organisation: { slug: "northstar-systems-two" }
    });
    expect(second.statusCode, second.body).toBe(201);
  });

  it("requires a valid sandbox credential, explicit custody boundaries, and an idempotency key", async () => {
    const { app } = await setup();
    const sandboxKey = await activate(app);
    const invalidCredential = await launch(app, `${sandboxKey.slice(0, -1)}A`);
    expect(invalidCredential.statusCode).toBe(401);

    const missingKey = await app.inject({
      method: "POST",
      url: "/v1/onboarding/launch",
      headers: { authorization: `Bearer ${sandboxKey}` },
      payload: launchRequest
    });
    expect(missingKey.statusCode).toBe(400);
    expect(missingKey.json<{ error: { code: string } }>().error.code).toBe("IDEMPOTENCY_KEY_REQUIRED");

    const missingAcknowledgement = await launch(app, sandboxKey, "launch-northstar-invalid", {
      ...launchRequest,
      acknowledgements: { keyCustody: false, syntheticExecution: true }
    });
    expect(missingAcknowledgement.statusCode).toBe(400);
    expect(missingAcknowledgement.json<{ error: { code: string } }>().error.code).toBe("VALIDATION_ERROR");
  });

  it("starts configured paid checkout while keeping Developer active until the verified webhook", async () => {
    const provider = new LaunchBillingProvider();
    const { app } = await setup(provider);
    const sandboxKey = await activate(app);
    const response = await launch(app, sandboxKey, "launch-northstar-team", {
      ...launchRequest,
      planIntent: "TEAM"
    });
    const result = response.json<ProductionLaunchResult>();

    expect(response.statusCode, response.body).toBe(201);
    expect(result.billing).toMatchObject({
      planIntent: "TEAM",
      activePlan: "DEVELOPER",
      checkoutAvailable: true,
      checkoutUrl: "https://checkout.stripe.test/launch-team"
    });
    expect(provider.checkoutInputs).toHaveLength(1);
    expect(provider.checkoutInputs[0]).toMatchObject({
      organisationId: result.workspace.id,
      planId: "TEAM",
      customerEmail: "taylor@northstar.test"
    });
  });
});
