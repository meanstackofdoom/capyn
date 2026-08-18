import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";

const base: NodeJS.ProcessEnv = {
  API_KEY_PEPPER: "capyn-test-pepper-with-at-least-32-characters",
  CAPYN_STORAGE: "memory"
};

describe("CAPYN deployment configuration", () => {
  it("keeps proxy trust disabled by default and parses an explicit controlled-proxy setting", () => {
    expect(loadConfig(base).TRUST_PROXY).toBe(false);
    expect(loadConfig({ ...base, TRUST_PROXY: "true" }).TRUST_PROXY).toBe(true);
  });

  it("fails closed when PostgreSQL is selected without a database URL", () => {
    expect(() => loadConfig({ ...base, CAPYN_STORAGE: "postgres" })).toThrow("DATABASE_URL is required");
  });

  it("requires an explicit journal path for single-service volume persistence", () => {
    expect(() => loadConfig({ ...base, CAPYN_STORAGE: "volume" })).toThrow("CAPYN_VOLUME_PATH is required");
    expect(loadConfig({ ...base, CAPYN_STORAGE: "volume", CAPYN_VOLUME_PATH: "/data/capyn/state.v8" }).CAPYN_STORAGE)
      .toBe("volume");
  });

  it("requires the complete Stripe configuration as one deployment unit", () => {
    expect(() => loadConfig({ ...base, STRIPE_SECRET_KEY: "sk_test_capyn" })).toThrow(
      "All Stripe billing variables must be configured together"
    );
  });

  it("requires remote Gate configuration as one fail-closed deployment unit", () => {
    expect(() => loadConfig({ ...base, CAPYN_EXECUTION_MODE: "remote-gate" })).toThrow(
      "Remote Gate mode requires the complete execution Gate configuration"
    );
    expect(() => loadConfig({ ...base, CAPYN_EXECUTION_GATE_URL: "https://gate.capyn.test" })).toThrow(
      "Set CAPYN_EXECUTION_MODE=remote-gate"
    );

    const configured = loadConfig({
      ...base,
      CAPYN_EXECUTION_MODE: "remote-gate",
      CAPYN_EXECUTION_GATE_URL: "https://gate.capyn.test",
      CAPYN_EXECUTION_GATE_CONTROL_TOKEN: "capyn-gate-control-token-at-least-32-characters",
      CAPYN_EXECUTION_GATE_ID: "gate-test",
      CAPYN_EXECUTION_PROVIDER_NAME: "aws-ec2-dry-run",
      CAPYN_EXECUTION_ISSUER: "urn:capyn:control:test",
      CAPYN_EXECUTION_AUDIENCE: "urn:capyn:gate:test",
      CAPYN_EXECUTION_KEY_ID: "test-key-1",
      CAPYN_EXECUTION_PRIVATE_KEY_B64: Buffer.from("not-a-real-private-key-but-config-schema-only").toString("base64")
    });
    expect(configured.CAPYN_EXECUTION_MODE).toBe("remote-gate");
  });

  it("pins production demo authentication to one explicit human identity", () => {
    expect(() => loadConfig({
      ...base,
      NODE_ENV: "production",
      DEMO_HUMAN_AUTH: "true"
    })).toThrow("A production demo must pin the human adapter to one explicit user");

    expect(loadConfig({
      ...base,
      NODE_ENV: "production",
      DEMO_HUMAN_AUTH: "true",
      DEMO_HUMAN_USER_ID: "usr_demo_approver"
    }).DEMO_HUMAN_USER_ID).toBe("usr_demo_approver");
  });
});
