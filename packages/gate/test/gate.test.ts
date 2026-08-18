import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  Es256ExecutionClaimIssuer,
  Es256ExecutionClaimVerifier,
  ExecutionClaimError,
  ExecutionGate,
  InMemoryExecutionClaimReplayStore,
  createEphemeralExecutionAuthority,
  executionActionHash,
  executionClaimId,
  type ExecutionClaimContext
} from "../src/index";

const NOW = new Date("2026-08-19T04:00:00.000Z");

function context(overrides: Partial<ExecutionClaimContext> = {}): ExecutionClaimContext {
  return {
    operation: "EXECUTE",
    organisationId: "org_acme",
    agentId: "agt_procurement",
    mandateId: "man_compute_v3",
    authorizationId: "auth_123",
    executionId: "exe_123",
    attempt: 1,
    action: {
      capability: "spend.compute",
      amountMinor: "12000",
      currency: "USD",
      vendor: { id: "aws", name: "AWS" },
      metadata: { purpose: "Provision bounded inference compute", region: "ap-southeast-2" }
    },
    ...overrides
  };
}

function keyPair() {
  return generateKeyPairSync("ec", {
    namedCurve: "P-256",
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });
}

function expectCode(error: unknown, code: string): boolean {
  expect(error).toBeInstanceOf(ExecutionClaimError);
  expect((error as ExecutionClaimError).code).toBe(code);
  return true;
}

function caught(action: () => unknown): unknown {
  try {
    action();
    return null;
  } catch (error) {
    return error;
  }
}

describe("execution claims", () => {
  it("binds one signed claim to the exact action and execution attempt", async () => {
    const authority = createEphemeralExecutionAuthority({
      issuer: "https://control.capyn.test",
      audience: "urn:capyn:gate:aws",
      clock: () => NOW
    });
    const expected = context();
    const issued = authority.issuer.issue(expected);

    expect(issued.payload.requestHash).toBe(executionActionHash(expected.action));
    expect(issued.payload.jti).toBe(executionClaimId(expected));
    await expect(authority.gate.consume(issued.token, expected)).resolves.toEqual(issued.payload);
  });

  it("rejects a different action even when every identity field is unchanged", async () => {
    const authority = createEphemeralExecutionAuthority({
      issuer: "https://control.capyn.test",
      audience: "urn:capyn:gate:aws",
      clock: () => NOW
    });
    const issued = authority.issuer.issue(context());
    const altered = context({ action: { ...context().action, amountMinor: "12001" } });

    await expect(authority.gate.consume(issued.token, altered)).rejects.toSatisfy(
      (error: unknown) => expectCode(error, "CLAIM_CONTEXT_MISMATCH")
    );
  });

  it("rejects a modified token before consuming its replay identifier", async () => {
    const authority = createEphemeralExecutionAuthority({
      issuer: "https://control.capyn.test",
      audience: "urn:capyn:gate:aws",
      clock: () => NOW
    });
    const expected = context();
    const issued = authority.issuer.issue(expected);
    const segments = issued.token.split(".");
    const payload = JSON.parse(Buffer.from(segments[1]!, "base64url").toString("utf8")) as Record<string, unknown>;
    payload["agentId"] = "agt_attacker";
    const modified = `${segments[0]}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${segments[2]}`;

    await expect(authority.gate.consume(modified, expected)).rejects.toSatisfy(
      (error: unknown) => expectCode(error, "INVALID_SIGNATURE")
    );
    await expect(authority.gate.consume(issued.token, expected)).resolves.toBeDefined();
  });

  it("atomically permits only one consumer of a claim", async () => {
    const authority = createEphemeralExecutionAuthority({
      issuer: "https://control.capyn.test",
      audience: "urn:capyn:gate:aws",
      clock: () => NOW
    });
    const expected = context();
    const issued = authority.issuer.issue(expected);

    const results = await Promise.allSettled([
      authority.gate.consume(issued.token, expected),
      authority.gate.consume(issued.token, expected)
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected?.status).toBe("rejected");
    if (rejected?.status === "rejected") expectCode(rejected.reason, "CLAIM_REPLAYED");
  });

  it("retains a consumed identifier throughout the verifier clock-skew window", async () => {
    const pair = keyPair();
    let now = NOW.getTime();
    const clock = () => new Date(now);
    const issuer = new Es256ExecutionClaimIssuer({
      privateKey: pair.privateKey,
      keyId: "key-1",
      issuer: "https://control.capyn.test",
      audience: "urn:capyn:gate:aws",
      ttlSeconds: 30,
      clock
    });
    const verifier = new Es256ExecutionClaimVerifier({
      publicKeys: { "key-1": pair.publicKey },
      expectedIssuer: issuer.issuer,
      expectedAudience: issuer.audience,
      allowedClockSkewSeconds: 5,
      clock
    });
    const gate = new ExecutionGate(verifier, new InMemoryExecutionClaimReplayStore(clock));
    const expected = context();
    const issued = issuer.issue(expected);
    await gate.consume(issued.token, expected);

    now += 31_000;
    await expect(gate.consume(issued.token, expected)).rejects.toSatisfy(
      (error: unknown) => expectCode(error, "CLAIM_REPLAYED")
    );
  });

  it("rejects expired claims and claims minted for another Gate", async () => {
    const pair = keyPair();
    const issuer = new Es256ExecutionClaimIssuer({
      privateKey: pair.privateKey,
      keyId: "key-1",
      issuer: "https://control.capyn.test",
      audience: "urn:capyn:gate:aws",
      ttlSeconds: 30,
      clock: () => NOW
    });
    const lateClock = () => new Date(NOW.getTime() + 31_000);
    const expiredVerifier = new Es256ExecutionClaimVerifier({
      publicKeys: { "key-1": pair.publicKey },
      expectedIssuer: "https://control.capyn.test",
      expectedAudience: "urn:capyn:gate:aws",
      allowedClockSkewSeconds: 0,
      clock: lateClock
    });
    const wrongAudienceVerifier = new Es256ExecutionClaimVerifier({
      publicKeys: { "key-1": pair.publicKey },
      expectedIssuer: "https://control.capyn.test",
      expectedAudience: "urn:capyn:gate:stripe",
      clock: () => NOW
    });
    const issued = issuer.issue(context());

    expectCode(caught(() => expiredVerifier.verify(issued.token, context())), "CLAIM_EXPIRED");
    expectCode(
      caught(() => wrongAudienceVerifier.verify(issued.token, context())),
      "CLAIM_CONTEXT_MISMATCH"
    );
  });

  it("allows a separately bound reconciliation attempt without reopening execution", async () => {
    const pair = keyPair();
    const issuer = new Es256ExecutionClaimIssuer({
      privateKey: pair.privateKey,
      keyId: "key-1",
      issuer: "https://control.capyn.test",
      audience: "urn:capyn:gate:aws",
      clock: () => NOW
    });
    const verifier = new Es256ExecutionClaimVerifier({
      publicKeys: { "key-1": pair.publicKey },
      expectedIssuer: "https://control.capyn.test",
      expectedAudience: "urn:capyn:gate:aws",
      clock: () => NOW
    });
    const gate = new ExecutionGate(verifier, new InMemoryExecutionClaimReplayStore(() => NOW));
    const executeContext = context();
    const reconciliationContext = context({ operation: "RECONCILE", attempt: 2 });

    await expect(gate.consume(issuer.issue(executeContext).token, executeContext)).resolves.toBeDefined();
    await expect(gate.consume(issuer.issue(reconciliationContext).token, reconciliationContext)).resolves.toBeDefined();
    expect(executionClaimId(reconciliationContext)).not.toBe(executionClaimId(executeContext));
  });
});
