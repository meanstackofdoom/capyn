import { generateKeyPairSync } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type { AuthorizationResult, ExecutionResultView } from "@capyn/types";
import {
  Es256ExecutionClaimIssuer,
  Es256ExecutionClaimVerifier,
  ExecutionClaimError,
  ExecutionGate,
  InMemoryExecutionClaimReplayStore,
  LocalExecutionGateway,
  createEphemeralExecutionAuthority,
  type ExecutionGateway
} from "@capyn/gate";
import {
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

function authority(
  executor: PaymentExecutor,
  signingPair = keyPair(),
  verificationPair = signingPair
): ExecutionAuthority {
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
    gateway: new LocalExecutionGateway({
      gateId: "capyn-recording-test-gate",
      gate: new ExecutionGate(verifier, new InMemoryExecutionClaimReplayStore(() => TEST_NOW)),
      executor,
      clock: () => TEST_NOW
    })
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
  it("calls the provider only after a request-bound execution claim is verified", async () => {
    const provider = new RecordingExecutor();
    const context = await createTestContext({ executionAuthority: authority(provider) });
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
      executionAuthority: authority(provider, keyPair(), keyPair())
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

  it("keeps a remote transport failure ambiguous because the Gate may already have invoked", async () => {
    const signing = createEphemeralExecutionAuthority({
      issuer: "urn:capyn:control:transport-test",
      audience: "urn:capyn:gate:transport-test",
      clock: () => TEST_NOW
    });
    const unavailableGateway: ExecutionGateway = {
      name: "remote-transport-test",
      invoke: async () => { throw new Error("response lost after dispatch"); }
    };
    const context = await createTestContext({
      executionAuthority: { issuer: signing.issuer, gateway: unavailableGateway }
    });
    openApps.push(context.app);

    const response = await authorizeAndExecute(context.app, "transport-loss-0001");
    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: { code: string } }>().error.code).toBe("EXECUTION_OUTCOME_UNKNOWN");
    expect(context.repository.inspect().executions[0]).toMatchObject({
      status: "PENDING",
      errorCode: "GATEWAY_OUTCOME_UNKNOWN"
    });
  });

  it("treats replay rejection as ambiguous because an earlier consume may have invoked", async () => {
    const signing = createEphemeralExecutionAuthority({
      issuer: "urn:capyn:control:replay-test",
      audience: "urn:capyn:gate:replay-test",
      clock: () => TEST_NOW
    });
    const replayingGateway: ExecutionGateway = {
      name: "remote-replay-test",
      invoke: async () => {
        throw new ExecutionClaimError("CLAIM_REPLAYED", "claim already consumed");
      }
    };
    const context = await createTestContext({
      executionAuthority: { issuer: signing.issuer, gateway: replayingGateway }
    });
    openApps.push(context.app);

    const response = await authorizeAndExecute(context.app, "replayed-claim-0001");
    expect(response.statusCode).toBe(409);
    expect(context.repository.inspect().executions[0]).toMatchObject({
      status: "PENDING",
      errorCode: "GATE_CLAIM_REPLAYED"
    });
  });
});
