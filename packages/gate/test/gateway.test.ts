import { describe, expect, it } from "vitest";
import {
  Es256ExecutionClaimVerifier,
  ExecutionGate,
  ExecutionGatewayRejectedError,
  HttpExecutionGateway,
  InMemoryExecutionClaimReplayStore,
  LocalExecutionGateway,
  createEphemeralExecutionAuthority,
  executionActionHash,
  executionClaimContextFromRequest,
  executionGateReceiptHash,
  executionGatewayRequestSchema,
  signExecutionGateReceipt,
  verifyExecutionGateReceipt,
  type EphemeralExecutionAuthority,
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

function localGateway(
  executor: PaymentExecutor,
  receiptSigningSecret?: string | Buffer
) {
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
      clock: () => NOW,
      ...(receiptSigningSecret !== undefined ? { receiptSigningSecret } : {})
    })
  };
}

function freshLocalGateway(
  authority: EphemeralExecutionAuthority,
  executor: PaymentExecutor,
  receiptSigningSecret?: string | Buffer
) {
  const verifier = new Es256ExecutionClaimVerifier({
    publicKeys: { "capyn-ephemeral-execution-key": authority.publicKeyPem },
    expectedIssuer: "urn:capyn:control:test",
    expectedAudience: "urn:capyn:gate:test",
    clock: () => NOW
  });
  return new LocalExecutionGateway({
    gateId: "gate-test",
    gate: new ExecutionGate(verifier, new InMemoryExecutionClaimReplayStore(() => NOW)),
    executor,
    clock: () => NOW,
    ...(receiptSigningSecret !== undefined ? { receiptSigningSecret } : {})
  });
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

  it("signs local receipts and verifies them when a signing secret is configured", async () => {
    const secret = "receipt-signing-secret-at-least-16-bytes";
    const executor = new RecordingExecutor();
    const { authority, gateway } = localGateway(executor, secret);
    const request = executionRequest("signed");
    const claim = authority.issuer.issue(executionClaimContextFromRequest(request, "EXECUTE"));

    const invocation = await gateway.invoke({ claim: claim.token, operation: "EXECUTE", request });

    expect(invocation.receipt.receiptSignature).toMatch(/^[a-f0-9]{64}$/);
    const { receiptSignature, ...unsignedReceipt } = invocation.receipt;
    expect(verifyExecutionGateReceipt(secret, unsignedReceipt, receiptSignature!)).toBe(true);
    expect(verifyExecutionGateReceipt("a-different-secret-of-sufficient-length", unsignedReceipt, receiptSignature!)).toBe(false);
  });

  it("rejects a receipt signature over tampered fields", async () => {
    const secret = "receipt-signing-secret-at-least-16-bytes";
    const { authority, gateway } = localGateway(new RecordingExecutor(), secret);
    const request = executionRequest("tamper");
    const claim = authority.issuer.issue(executionClaimContextFromRequest(request, "EXECUTE"));
    const invocation = await gateway.invoke({ claim: claim.token, operation: "EXECUTE", request });

    const { receiptSignature, ...unsignedReceipt } = invocation.receipt;
    const tampered = {
      ...unsignedReceipt,
      reference: "provider_exe_tampered"
    };
    expect(verifyExecutionGateReceipt(secret, tampered, receiptSignature!)).toBe(false);
  });

  it("rejects short receipt signing secrets", async () => {
    const executor = new RecordingExecutor();
    const { authority, gateway: unsignedGateway } = localGateway(executor);
    const request = executionRequest("short-secret");
    const claim = authority.issuer.issue(executionClaimContextFromRequest(request, "EXECUTE"));
    const invocation = await unsignedGateway.invoke({ claim: claim.token, operation: "EXECUTE", request });
    const { receiptSignature, ...unsignedReceipt } = invocation.receipt;
    expect(receiptSignature).toBeUndefined();
    expect(() => signExecutionGateReceipt("short", unsignedReceipt)).toThrow("at least 16 bytes");
  });

  it("verifies a signed remote receipt and rejects unsigned or mis-signed responses", async () => {
    const secret = "receipt-signing-secret-at-least-16-bytes";
    const executor = new RecordingExecutor();
    const authority = createEphemeralExecutionAuthority({
      issuer: "urn:capyn:control:test",
      audience: "urn:capyn:gate:test",
      clock: () => NOW
    });
    const request = executionRequest("http-signed");
    const claim = authority.issuer.issue(executionClaimContextFromRequest(request, "EXECUTE"));

    const { gateway: signedLocal } = { gateway: freshLocalGateway(authority, executor, secret) };
    const remote = new HttpExecutionGateway({
      baseUrl: "https://gate.capyn.test",
      controlToken: "control-token-with-at-least-32-characters",
      providerName: executor.name,
      expectedGateId: "gate-test",
      receiptSigningSecret: secret,
      fetchImplementation: async (
        _input: string | URL | Request,
        init?: RequestInit
      ): Promise<Response> => {
        if (typeof init?.body !== "string") throw new Error("Expected a serialized Gate request");
        const invocation = executionGatewayRequestSchema.parse(JSON.parse(init.body));
        return new Response(JSON.stringify(await signedLocal.invoke(invocation)), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
    });

    await expect(remote.invoke({ claim: claim.token, operation: "EXECUTE", request })).resolves.toMatchObject({
      result: { status: "EXECUTED", reference: "provider_exe_http-signed" },
      receipt: { gateId: "gate-test" }
    });

    const unsignedLocal = freshLocalGateway(authority, executor);
    const rejecting = new HttpExecutionGateway({
      baseUrl: "https://gate.capyn.test",
      controlToken: "control-token-with-at-least-32-characters",
      providerName: executor.name,
      expectedGateId: "gate-test",
      receiptSigningSecret: secret,
      fetchImplementation: async (
        _input: string | URL | Request,
        init?: RequestInit
      ): Promise<Response> => {
        if (typeof init?.body !== "string") throw new Error("Expected a serialized Gate request");
        const invocation = executionGatewayRequestSchema.parse(JSON.parse(init.body));
        return new Response(JSON.stringify(await unsignedLocal.invoke(invocation)), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
    });
    await expect(rejecting.invoke({ claim: claim.token, operation: "EXECUTE", request }))
      .rejects.toThrow("Execution Gate receipt is not signed");

    const signedLocalForTamper = freshLocalGateway(authority, executor, secret);
    const tampering = new HttpExecutionGateway({
      baseUrl: "https://gate.capyn.test",
      controlToken: "control-token-with-at-least-32-characters",
      providerName: executor.name,
      expectedGateId: "gate-test",
      receiptSigningSecret: secret,
      fetchImplementation: async (
        _input: string | URL | Request,
        init?: RequestInit
      ): Promise<Response> => {
        if (typeof init?.body !== "string") throw new Error("Expected a serialized Gate request");
        const invocation = executionGatewayRequestSchema.parse(JSON.parse(init.body));
        const result = await signedLocalForTamper.invoke(invocation);
        return new Response(JSON.stringify({
          result: result.result,
          receipt: { ...result.receipt, receiptSignature: "0".repeat(64) }
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
    });
    await expect(tampering.invoke({ claim: claim.token, operation: "EXECUTE", request }))
      .rejects.toThrow("Execution Gate receipt signature is invalid");
  });
});
