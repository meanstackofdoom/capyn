import { PrismaClient } from "@prisma/client";
import { fileURLToPath } from "node:url";
import { PrismaExecutionClaimReplayStore } from "@capyn/database";
import {
  Es256ExecutionClaimVerifier,
  ExecutionGate,
  InMemoryExecutionClaimReplayStore,
  LocalExecutionGateway
} from "@capyn/gate";
import { buildGateApp } from "./app";
import { loadGateConfig } from "./config";
import { AwsEc2DryRunExecutor } from "./providers/aws-ec2-dry-run";

try {
  process.loadEnvFile?.(fileURLToPath(new URL("../../../.env", import.meta.url)));
} catch {
  // Environment variables may be supplied by the process manager instead.
}

const config = loadGateConfig();
const prisma = config.GATE_REPLAY_STORAGE === "postgres" ? new PrismaClient() : null;
const replayStore = prisma
  ? new PrismaExecutionClaimReplayStore(prisma, config.replayNamespace)
  : new InMemoryExecutionClaimReplayStore();
const verifier = new Es256ExecutionClaimVerifier({
  publicKeys: config.publicKeys,
  expectedIssuer: config.GATE_EXPECTED_ISSUER,
  expectedAudience: config.GATE_AUDIENCE,
  allowedClockSkewSeconds: config.GATE_ALLOWED_CLOCK_SKEW_SECONDS,
  maximumTtlSeconds: config.GATE_MAX_CLAIM_TTL_SECONDS
});
const gateway = new LocalExecutionGateway({
  gateId: config.GATE_ID,
  gate: new ExecutionGate(verifier, replayStore),
  executor: new AwsEc2DryRunExecutor(config.blueprints)
});
const app = await buildGateApp({
  gateway,
  controlToken: config.GATE_CONTROL_TOKEN,
  ready: async () => {
    if (prisma) await prisma.executionClaimConsumption.findFirst({ select: { claimId: true } });
  }
});

const shutdown = async (signal: string): Promise<void> => {
  app.log.info({ signal }, "shutting down");
  await app.close();
  await prisma?.$disconnect();
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({ port: config.PORT, host: config.HOST });
