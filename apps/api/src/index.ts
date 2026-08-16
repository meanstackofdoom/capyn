import { createDemoMemoryRepository, hashApiKey, PrismaCapynRepository } from "@capyn/database";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app";
import { loadConfig } from "./config";

try {
  process.loadEnvFile?.(fileURLToPath(new URL("../../../.env", import.meta.url)));
} catch {
  // Environment variables may be supplied by the process manager instead.
}

const config = loadConfig();
const memory = createDemoMemoryRepository(
  hashApiKey("capyn_demo_N7m2kQ4xR8vB3pL6sT9wY1cF5hJ0dG2a", config.API_KEY_PEPPER)
);
const repository = config.CAPYN_STORAGE === "memory" ? memory.repository : new PrismaCapynRepository();
const app = await buildApp({
  repository,
  apiKeyPepper: config.API_KEY_PEPPER,
  allowDemoHumanHeader: config.DEMO_HUMAN_AUTH,
  ...(config.BOOTSTRAP_TOKEN ? { bootstrapToken: config.BOOTSTRAP_TOKEN } : {}),
  webOrigin: config.WEB_ORIGIN
});

const shutdown = async (signal: string): Promise<void> => {
  app.log.info({ signal }, "shutting down");
  await app.close();
  if (repository instanceof PrismaCapynRepository) await repository.client.$disconnect();
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({ port: config.PORT, host: config.HOST });
