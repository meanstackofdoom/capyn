import { createDemoMemoryRepository, createVolumeCapynRepository, hashApiKey, PrismaCapynRepository } from "@capyn/database";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app";
import { loadConfig } from "./config";
import { StripeBillingProvider } from "./domain/billing-provider";

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
const app = await buildApp({
  repository,
  apiKeyPepper: config.API_KEY_PEPPER,
  allowDemoHumanHeader: config.DEMO_HUMAN_AUTH,
  ...(config.DEMO_HUMAN_USER_ID ? { demoHumanUserId: config.DEMO_HUMAN_USER_ID } : {}),
  ...(config.BOOTSTRAP_TOKEN ? { bootstrapToken: config.BOOTSTRAP_TOKEN } : {}),
  ...(billingProvider ? { billingProvider } : {}),
  webOrigin: config.WEB_ORIGIN,
  trustProxy: config.TRUST_PROXY,
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
