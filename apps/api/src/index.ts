import { createDemoMemoryRepository, createVolumeCapynRepository, hashApiKey, PrismaCapynRepository } from "@capyn/database";
import { fileURLToPath } from "node:url";
import { Es256ExecutionClaimIssuer, HttpExecutionGateway } from "@capyn/gate";
import { buildApp } from "./app";
import { loadConfig } from "./config";
import { StripeBillingProvider } from "./domain/billing-provider";
import type { ExecutionAuthority } from "./domain/execution-service";

try {
  process.loadEnvFile?.(fileURLToPath(new URL("../../../.env", import.meta.url)));
} catch {
  // Environment variables may be supplied by the process manager instead.
}

const config = loadConfig();
const demoKeyHash = hashApiKey(
  "capyn_demo_N7m2kQ4xR8vB3pL6sT9wY1cF5hJ0dG2a",
  config.API_KEY_PEPPER
);
const memory = createDemoMemoryRepository(
  demoKeyHash
);
let repository = config.CAPYN_STORAGE === "memory" ? memory.repository : new PrismaCapynRepository();
if (config.CAPYN_STORAGE === "volume") {
  if (!config.CAPYN_VOLUME_PATH) throw new Error("CAPYN_VOLUME_PATH is required in volume mode");
  repository = (await createVolumeCapynRepository(config.CAPYN_VOLUME_PATH, demoKeyHash)).repository;
}
const billingProvider = config.STRIPE_SECRET_KEY
  ? new StripeBillingProvider({
      secretKey: config.STRIPE_SECRET_KEY,
      webhookSecret: config.STRIPE_WEBHOOK_SECRET!,
      teamPriceId: config.STRIPE_PRICE_TEAM_MONTHLY!,
      businessPriceId: config.STRIPE_PRICE_BUSINESS_MONTHLY!
    })
  : undefined;
let executionAuthority: ExecutionAuthority | undefined;
if (config.CAPYN_EXECUTION_MODE === "remote-gate") {
  const privateKey = Buffer.from(config.CAPYN_EXECUTION_PRIVATE_KEY_B64!, "base64").toString("utf8");
  const receiptVerifySecret = config.CAPYN_EXECUTION_GATE_RECEIPT_VERIFY_SECRET_B64
    ? Buffer.from(config.CAPYN_EXECUTION_GATE_RECEIPT_VERIFY_SECRET_B64, "base64")
    : undefined;
  if (receiptVerifySecret && receiptVerifySecret.length < 16) {
    throw new Error("CAPYN_EXECUTION_GATE_RECEIPT_VERIFY_SECRET_B64 must decode to at least 16 bytes");
  }
  if (!privateKey.includes("BEGIN PRIVATE KEY")) {
    throw new Error("CAPYN_EXECUTION_PRIVATE_KEY_B64 must decode to a PKCS#8 PEM private key");
  }
  executionAuthority = {
    issuer: new Es256ExecutionClaimIssuer({
      privateKey,
      keyId: config.CAPYN_EXECUTION_KEY_ID!,
      issuer: config.CAPYN_EXECUTION_ISSUER!,
      audience: config.CAPYN_EXECUTION_AUDIENCE!,
      ttlSeconds: config.CAPYN_EXECUTION_CLAIM_TTL_SECONDS
    }),
    gateway: new HttpExecutionGateway({
      baseUrl: config.CAPYN_EXECUTION_GATE_URL!,
      controlToken: config.CAPYN_EXECUTION_GATE_CONTROL_TOKEN!,
      providerName: config.CAPYN_EXECUTION_PROVIDER_NAME!,
      expectedGateId: config.CAPYN_EXECUTION_GATE_ID!,
      ...(receiptVerifySecret ? { receiptSigningSecret: receiptVerifySecret } : {}),
      timeoutMs: config.CAPYN_EXECUTION_GATE_TIMEOUT_MS
    })
  };
}
const app = await buildApp({
  repository,
  apiKeyPepper: config.API_KEY_PEPPER,
  allowDemoHumanHeader: config.DEMO_HUMAN_AUTH,
  ...(config.DEMO_HUMAN_USER_ID ? { demoHumanUserId: config.DEMO_HUMAN_USER_ID } : {}),
  ...(config.BOOTSTRAP_TOKEN ? { bootstrapToken: config.BOOTSTRAP_TOKEN } : {}),
  ...(billingProvider ? { billingProvider } : {}),
  ...(executionAuthority ? { executionAuthority } : {}),
  webOrigin: config.WEB_ORIGIN,
  trustProxy: config.TRUST_PROXY,
  ...(config.CAPYN_EXECUTION_SWEEP_ENABLED
    ? { executionSweep: { intervalMs: config.CAPYN_EXECUTION_SWEEP_INTERVAL_MS } }
    : {}),
  onboardingPersistence: config.CAPYN_STORAGE === "postgres"
    ? "POSTGRESQL"
    : config.CAPYN_STORAGE === "volume"
      ? "VOLUME_JOURNAL"
      : "PROCESS_MEMORY"
});

const shutdown = async (signal: string): Promise<void> => {
  app.log.info({ signal }, "shutting down");
  await app.close();
  if (repository instanceof PrismaCapynRepository) await repository.client.$disconnect();
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({ port: config.PORT, host: config.HOST });
