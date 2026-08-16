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

  it("requires the complete Stripe configuration as one deployment unit", () => {
    expect(() => loadConfig({ ...base, STRIPE_SECRET_KEY: "sk_test_capyn" })).toThrow(
      "All Stripe billing variables must be configured together"
    );
  });
});
