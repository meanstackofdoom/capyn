import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import {
  LocalExecutionGateway,
  createEphemeralExecutionAuthority,
  executionActionHash,
  executionClaimContextFromRequest,
  type ExecutionRequest
} from "@capyn/gate";
import { buildGateApp } from "../src/app";
import { AWS_EC2_DRY_RUN_CAPABILITY, AwsEc2DryRunExecutor } from "../src/providers/aws-ec2-dry-run";

const NOW = new Date("2026-08-19T01:30:00.000Z");
const CONTROL_TOKEN = "capyn-gate-control-token-at-least-32-characters";
const openApps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

function request(): ExecutionRequest {
  const action = {
    capability: AWS_EC2_DRY_RUN_CAPABILITY,
    amountMinor: "12000",
    currency: "USD" as const,
    vendor: { id: "aws", name: "AWS" },
    metadata: {
      mode: "DRY_RUN",
      environment: "sandbox",
      blueprintId: "capyn-t3-micro-v1",
      region: "ap-southeast-2",
      instanceCount: 1,
      purpose: "Validate a capped compute request"
    }
  };
  return {
    executionId: "exe_gate_http",
    authorizationId: "aut_gate_http",
    organisationId: "org_gate_http",
    agentId: "agt_gate_http",
    mandateId: "man_gate_http",
    ...action,
    requestHash: executionActionHash(action),
    attemptCount: 1
  };
}

async function setup() {
  const authority = createEphemeralExecutionAuthority({
    issuer: "urn:capyn:control:test",
    audience: "urn:capyn:gate:test",
    clock: () => NOW
  });
  const executor = new AwsEc2DryRunExecutor([{
    id: "capyn-t3-micro-v1",
    region: "ap-southeast-2",
    instanceType: "t3.micro",
    imageFamily: "al2023",
    instanceCount: 1,
    maxMonthlyCostMinor: "12000"
  }]);
  const app = await buildGateApp({
    gateway: new LocalExecutionGateway({
      gateId: "gate-http-test",
      gate: authority.gate,
      executor,
      clock: () => NOW
    }),
    controlToken: CONTROL_TOKEN,
    logger: false,
    disableRateLimit: true
  });
  openApps.push(app);
  return { app, authority };
}

describe("deployable Gate HTTP boundary", () => {
  it("authenticates the control plane, consumes once, invokes the dry-run adapter, and returns evidence", async () => {
    const { app, authority } = await setup();
    const execution = request();
    const claim = authority.issuer.issue(executionClaimContextFromRequest(execution, "EXECUTE"));
    const payload = { claim: claim.token, operation: "EXECUTE", request: execution };

    const unauthenticated = await app.inject({ method: "POST", url: "/v1/invoke", payload });
    expect(unauthenticated.statusCode).toBe(401);

    const first = await app.inject({
      method: "POST",
      url: "/v1/invoke",
      headers: { authorization: `Bearer ${CONTROL_TOKEN}` },
      payload
    });
    expect(first.statusCode, first.body).toBe(200);
    expect(first.json()).toMatchObject({
      result: { status: "EXECUTED", reference: "aws_dry_run_exe_gate_http" },
      receipt: {
        gateId: "gate-http-test",
        claimId: claim.payload.jti,
        provider: "aws-ec2-dry-run",
        outcome: "EXECUTED"
      }
    });

    const replay = await app.inject({
      method: "POST",
      url: "/v1/invoke",
      headers: { authorization: `Bearer ${CONTROL_TOKEN}` },
      payload
    });
    expect(replay.statusCode).toBe(409);
    expect(replay.json()).toMatchObject({ error: { code: "GATE_CLAIM_REPLAYED" } });
  });

  it("exposes separate liveness and dependency-readiness endpoints", async () => {
    const { app } = await setup();
    expect((await app.inject({ method: "GET", url: "/healthz" })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/ready" })).json()).toMatchObject({
      status: "ready",
      provider: "aws-ec2-dry-run"
    });
  });
});
