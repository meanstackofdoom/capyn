import { generateKeyPairSync } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type { AuthorizationResult, ExecutionResultView } from "@capyn/types";
import {
  Es256ExecutionClaimIssuer,
  Es256ExecutionClaimVerifier,
  ExecutionGate,
  InMemoryExecutionClaimReplayStore
} from "@capyn/gate";
import {
  ExecutionService,
  type ExecutionAuthority,
  type ExecutionRequest,
  type PaymentExecutionResult,
  type PaymentExecutor
} from "../src/domain/execution-service";
import { agentHeaders, allowedRequest, createTestContext, TEST_NOW } from "./helpers";

const openApps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

function keyPair() {
  return generateKeyPairSync("ec", {
    namedCurve: "P-256",
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });
}

function authority(signingPair = keyPair(), verificationPair = signingPair): ExecutionAuthority {
  const issuer = new Es256ExecutionClaimIssuer({
    privateKey: signingPair.privateKey,
    keyId: "capyn-test-key",
    issuer: "https://control.capyn.test",
    audience: "urn:capyn:gate:recording-test",
    clock: () => TEST_NOW
  });
  const verifier = new Es256ExecutionClaimVerifier({
    publicKeys: { "capyn-test-key": verificationPair.publicKey },
    expectedIssuer: issuer.issuer,
    expectedAudience: issuer.audience,
    clock: () => TEST_NOW
  });
  return {
    issuer,
    gate: new ExecutionGate(verifier, new InMemoryExecutionClaimReplayStore(() => TEST_NOW))
  };
}

class RecordingExecutor implements PaymentExecutor {
  readonly name = "recording-test";
  executeCalls = 0;
  reconcileCalls = 0;

  async execute(request: ExecutionRequest): Promise<PaymentExecutionResult> {
    this.executeCalls += 1;
    return { status: "EXECUTED", reference: `provider_${request.executionId}`, errorCode: null };
  }

  async reconcile(): Promise<PaymentExecutionResult> {
    this.reconcileCalls += 1;
    return { status: "FAILED", reference: null, errorCode: "NOT_EXPECTED" };
  }
}

async function authorizeAndExecute(app: FastifyInstance, suffix: string) {
  const authorization = await app.inject({
    method: "POST",
    url: "/v1/authorize",
    headers: agentHeaders(`gate-authorize-${suffix}`),
    payload: allowedRequest
  });
  expect(authorization.statusCode, authorization.body).toBe(200);
  const authorizationId = authorization.json<AuthorizationResult>().authorizationId;
  return app.inject({
    method: "POST",
    url: `/v1/authorizations/${authorizationId}/execute`,
    headers: { authorization: agentHeaders(`gate-execute-${suffix}`).authorization }
  });
}

describe("execution Gate integration", () => {
  it("refuses to attach a non-mock provider without an explicit authority and Gate", async () => {
    const context = await createTestContext();
    openApps.push(context.app);

    expect(
      () => new ExecutionService(context.repository, new RecordingExecutor(), () => TEST_NOW)
    ).toThrow("A non-mock executor requires an explicitly configured execution authority and Gate");
  });

  it("calls the provider only after a request-bound execution claim is verified", async () => {
    const provider = new RecordingExecutor();
    const context = await createTestContext({ executor: provider, executionAuthority: authority() });
    openApps.push(context.app);

    const response = await authorizeAndExecute(context.app, "valid-0001");
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json<ExecutionResultView>().status).toBe("EXECUTED");
    expect(provider.executeCalls).toBe(1);

    const state = context.repository.inspect();
    const recorded = state.auditEvents.find((event) => event.eventType === "EXECUTION_RECORDED");
    expect(recorded?.metadata).toMatchObject({
      authorityOperation: "EXECUTE",
      requestHash: state.authorizations[0]?.requestHash,
      errorCode: null
    });
    expect(recorded?.metadata["authorityClaimId"]).toMatch(/^[a-f0-9]{64}$/);
  });

  it("fails closed before the provider when the Gate cannot verify the signing key", async () => {
    const provider = new RecordingExecutor();
    const context = await createTestContext({
      executor: provider,
      executionAuthority: authority(keyPair(), keyPair())
    });
    openApps.push(context.app);

    const response = await authorizeAndExecute(context.app, "invalid-signature-0001");
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json<ExecutionResultView>()).toMatchObject({ status: "FAILED", reference: null });
    expect(provider.executeCalls).toBe(0);
    expect(provider.reconcileCalls).toBe(0);

    const state = context.repository.inspect();
    expect(state.executions[0]).toMatchObject({ status: "FAILED", errorCode: "GATE_INVALID_SIGNATURE" });
    expect(state.authorizations[0]?.state).toBe("FAILED");
    expect(state.auditEvents.find((event) => event.eventType === "EXECUTION_RECORDED")?.metadata).toMatchObject({
      status: "FAILED",
      errorCode: "GATE_INVALID_SIGNATURE"
    });
  });
});
