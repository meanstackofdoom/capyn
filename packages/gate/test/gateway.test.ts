import { describe, expect, it } from "vitest";
import {
  ExecutionGatewayRejectedError,
  HttpExecutionGateway,
  LocalExecutionGateway,
  createEphemeralExecutionAuthority,
  executionActionHash,
  executionClaimContextFromRequest,
  executionGateReceiptHash,
  executionGatewayRequestSchema,
  type ExecutionRequest,
  type PaymentExecutor
} from "../src/index";

const NOW = new Date("2026-08-19T01:30:00.000Z");

function executionRequest(suffix = "1"): ExecutionRequest {
  const action = {
    capability: "spend.compute",
    amountMinor: "1800",
    currency: "USD" as const,
    vendor: { id: "aws", name: "AWS" },
    metadata: { purpose: "Gate integration test" }
  };
  return {
    executionId: `exe_${suffix}`,
    authorizationId: `aut_${suffix}`,
    organisationId: "org_test",
    agentId: "agt_test",
    mandateId: "man_test",
    ...action,
    requestHash: executionActionHash(action),
    attemptCount: 1
  };
}

class RecordingExecutor implements PaymentExecutor {
  readonly name = "recording-provider";
  calls = 0;

  async execute(request: ExecutionRequest) {
    this.calls += 1;
    return { status: "EXECUTED" as const, reference: `provider_${request.executionId}`, errorCode: null };
  }

  async reconcile(request: ExecutionRequest) {
    this.calls += 1;
    return { status: "EXECUTED" as const, reference: `provider_${request.executionId}`, errorCode: null };
  }
}

function localGateway(executor: PaymentExecutor) {
  const authority = createEphemeralExecutionAuthority({
    issuer: "urn:capyn:control:test",
    audience: "urn:capyn:gate:test",
    clock: () => NOW
  });
  return {
    authority,
    gateway: new LocalExecutionGateway({
      gateId: "gate-test",
      gate: authority.gate,
      executor,
      clock: () => NOW
    })
  };
}

describe("execution gateway", () => {
  it("consumes the exact claim before invoking a provider and emits a matching receipt", async () => {
    const executor = new RecordingExecutor();
    const { authority, gateway } = localGateway(executor);
    const request = executionRequest();
    const claim = authority.issuer.issue(executionClaimContextFromRequest(request, "EXECUTE"));

    const invocation = await gateway.invoke({ claim: claim.token, operation: "EXECUTE", request });

    expect(executor.calls).toBe(1);
    expect(invocation.result).toEqual({
      status: "EXECUTED",
      reference: "provider_exe_1",
      errorCode: null
    });
    expect(invocation.receipt).toMatchObject({
      gateId: "gate-test",
      claimId: claim.payload.jti,
      requestHash: request.requestHash,
      provider: executor.name,
      outcome: "EXECUTED"
    });
    const { receiptHash, ...receiptBase } = invocation.receipt;
    expect(executionGateReceiptHash(receiptBase)).toBe(receiptHash);
    await expect(gateway.invoke({ claim: claim.token, operation: "EXECUTE", request })).rejects.toMatchObject({
      code: "CLAIM_REPLAYED"
    });
    expect(executor.calls).toBe(1);
  });

  it("records a provider exception after consumption as an unknown outcome", async () => {
    const executor: PaymentExecutor = {
      name: "throwing-provider",
      execute: async () => { throw new Error("response lost"); },
      reconcile: async () => { throw new Error("response lost"); }
    };
    const { authority, gateway } = localGateway(executor);
    const request = executionRequest("unknown");
    const claim = authority.issuer.issue(executionClaimContextFromRequest(request, "EXECUTE"));

    await expect(gateway.invoke({ claim: claim.token, operation: "EXECUTE", request })).resolves.toMatchObject({
      result: { status: "UNKNOWN", errorCode: "PROVIDER_OUTCOME_UNKNOWN" },
      receipt: { outcome: "UNKNOWN" }
    });
  });

  it("validates a remote receipt against the dispatched claim", async () => {
    const executor = new RecordingExecutor();
    const { authority, gateway: local } = localGateway(executor);
    const request = executionRequest("http");
    const claim = authority.issuer.issue(executionClaimContextFromRequest(request, "EXECUTE"));
    const fetchImplementation = async (
      _input: string | URL | Request,
      init?: RequestInit
    ): Promise<Response> => {
      expect(init?.headers).toMatchObject({ authorization: "Bearer control-token-with-at-least-32-characters" });
      if (typeof init?.body !== "string") throw new Error("Expected a serialized Gate request");
      const decoded: unknown = JSON.parse(init.body);
      const invocation = executionGatewayRequestSchema.parse(decoded);
      return new Response(JSON.stringify(await local.invoke(invocation)), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    };
    const remote = new HttpExecutionGateway({
      baseUrl: "https://gate.capyn.test",
      controlToken: "control-token-with-at-least-32-characters",
      providerName: executor.name,
      expectedGateId: "gate-test",
      fetchImplementation
    });

    await expect(remote.invoke({ claim: claim.token, operation: "EXECUTE", request })).resolves.toMatchObject({
      result: { status: "EXECUTED", reference: "provider_exe_http" },
      receipt: { gateId: "gate-test" }
    });
  });

  it("distinguishes definitive control-channel rejection from ambiguous transport loss", async () => {
    const request = executionRequest("errors");
    const authority = createEphemeralExecutionAuthority({
      issuer: "urn:capyn:control:test",
      audience: "urn:capyn:gate:test",
      clock: () => NOW
    });
    const claim = authority.issuer.issue(executionClaimContextFromRequest(request, "EXECUTE"));
    const rejected = new HttpExecutionGateway({
      baseUrl: "https://gate.capyn.test",
      controlToken: "control-token-with-at-least-32-characters",
      providerName: "recording-provider",
      expectedGateId: "gate-test",
      fetchImplementation: async () => new Response(
        JSON.stringify({ error: { code: "GATE_CONTROL_CHANNEL_REJECTED" } }),
        { status: 401 }
      )
    });
    await expect(rejected.invoke({ claim: claim.token, operation: "EXECUTE", request }))
      .rejects.toBeInstanceOf(ExecutionGatewayRejectedError);

    const unavailable = new HttpExecutionGateway({
      baseUrl: "https://gate.capyn.test",
      controlToken: "control-token-with-at-least-32-characters",
      providerName: "recording-provider",
      expectedGateId: "gate-test",
      fetchImplementation: async () => { throw new Error("connection lost"); }
    });
    await expect(unavailable.invoke({ claim: claim.token, operation: "EXECUTE", request }))
      .rejects.toThrow("connection lost");
  });
});
