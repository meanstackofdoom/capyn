import { describe, expect, it } from "vitest";
import { loadGateConfig } from "../src/config";

const publicKey = "-----BEGIN PUBLIC KEY-----\n" + "A".repeat(96) + "\n-----END PUBLIC KEY-----";
const blueprint = {
  id: "capyn-t3-micro-v1",
  region: "ap-southeast-2",
  instanceType: "t3.micro",
  imageFamily: "al2023",
  instanceCount: 1,
  maxMonthlyCostMinor: "12000"
};
const base: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  GATE_REPLAY_STORAGE: "memory",
  GATE_CONTROL_TOKEN: "capyn-gate-control-token-at-least-32-characters",
  GATE_ID: "gate-test",
  GATE_EXPECTED_ISSUER: "urn:capyn:control:test",
  GATE_AUDIENCE: "urn:capyn:gate:test",
  GATE_PUBLIC_KEYS_B64: Buffer.from(JSON.stringify({ "test-key": publicKey })).toString("base64"),
  AWS_SANDBOX_BLUEPRINTS_B64: Buffer.from(JSON.stringify([blueprint])).toString("base64")
};

describe("Gate deployment configuration", () => {
  it("decodes public verification keys and fixed AWS blueprints", () => {
    expect(loadGateConfig(base)).toMatchObject({
      GATE_REPLAY_STORAGE: "memory",
      publicKeys: { "test-key": publicKey },
      blueprints: [blueprint],
      replayNamespace: expect.stringMatching(/^[a-f0-9]{64}$/)
    });
  });

  it("requires PostgreSQL replay storage in production", () => {
    expect(() => loadGateConfig({ ...base, NODE_ENV: "production" })).toThrow(
      "Production Gate requires PostgreSQL replay storage"
    );
    expect(() => loadGateConfig({ ...base, GATE_REPLAY_STORAGE: "postgres" })).toThrow(
      "DATABASE_URL is required"
    );
  });

  it("decodes an optional receipt signing secret and rejects short secrets", () => {
    const secret = Buffer.from("at-least-16-bytes!");
    expect(loadGateConfig({ ...base, GATE_RECEIPT_SIGNING_SECRET_B64: secret.toString("base64") })
      .receiptSigningSecret?.toString("base64")).toBe(secret.toString("base64"));
    expect(() => loadGateConfig({
      ...base,
      GATE_RECEIPT_SIGNING_SECRET_B64: Buffer.from("short").toString("base64")
    })).toThrow("must decode to at least 16 bytes");
  });

  it("fails closed for malformed key or blueprint configuration", () => {
    expect(() => loadGateConfig({
      ...base,
      GATE_PUBLIC_KEYS_B64: Buffer.from(JSON.stringify({})).toString("base64")
    })).toThrow("At least one Gate public key is required");
    expect(() => loadGateConfig({
      ...base,
      AWS_SANDBOX_BLUEPRINTS_B64: Buffer.from(JSON.stringify([{ ...blueprint, instanceCount: 2 }])).toString("base64")
    })).toThrow("Invalid CAPYN Gate configuration");
  });
});
