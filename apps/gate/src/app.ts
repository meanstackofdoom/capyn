import { createHash, timingSafeEqual } from "node:crypto";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import {
  ExecutionClaimError,
  executionGatewayRequestSchema,
  type ExecutionGateway
} from "@capyn/gate";

export interface GateAppDependencies {
  gateway: ExecutionGateway;
  controlToken: string;
  ready?: () => Promise<void>;
  logger?: boolean;
  disableRateLimit?: boolean;
}

function tokenDigest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function bearerToken(value: string | undefined): string | null {
  if (!value?.startsWith("Bearer ")) return null;
  const token = value.slice(7);
  return token.length > 0 && !/\s/.test(token) ? token : null;
}

export async function buildGateApp(dependencies: GateAppDependencies): Promise<FastifyInstance> {
  if (dependencies.controlToken.length < 32) throw new Error("Gate control token must be at least 32 characters");
  const expectedTokenDigest = tokenDigest(dependencies.controlToken);
  const app = Fastify({
    logger: dependencies.logger ?? {
      level: process.env.LOG_LEVEL ?? "info",
      redact: { paths: ["req.headers.authorization"], censor: "[REDACTED]" }
    },
    bodyLimit: 32 * 1024,
    requestIdHeader: "x-request-id"
  });

  await app.register(helmet, { global: true, contentSecurityPolicy: false });
  if (!dependencies.disableRateLimit) {
    await app.register(rateLimit, {
      max: 300,
      timeWindow: "1 minute",
      keyGenerator: (request) => request.ip
    });
  }

  app.get("/healthz", async () => ({ status: "ok", service: "capyn-gate", version: "0.4.0" }));
  app.get("/ready", async (_request, reply) => {
    try {
      await dependencies.ready?.();
      return { status: "ready", service: "capyn-gate", provider: dependencies.gateway.name };
    } catch {
      return reply.code(503).send({ status: "unavailable", service: "capyn-gate" });
    }
  });

  app.post("/v1/invoke", async (request, reply) => {
    const supplied = bearerToken(request.headers.authorization);
    const suppliedDigest = tokenDigest(supplied ?? "");
    if (!supplied || !timingSafeEqual(expectedTokenDigest, suppliedDigest)) {
      return reply.code(401).send({
        error: { code: "GATE_CONTROL_CHANNEL_REJECTED", message: "Valid Gate control authentication is required" }
      });
    }
    const parsed = executionGatewayRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: "GATE_REQUEST_INVALID", message: "Invalid Gate invocation" } });
    }
    try {
      return await dependencies.gateway.invoke(parsed.data);
    } catch (error) {
      if (error instanceof ExecutionClaimError) {
        return reply.code(error.code === "CLAIM_REPLAYED" ? 409 : 422).send({
          error: { code: `GATE_${error.code}`, message: error.message }
        });
      }
      request.log.error({ err: error }, "Gate invocation failed without a returnable outcome");
      return reply.code(500).send({ error: { code: "GATE_INTERNAL_ERROR", message: "Gate invocation failed" } });
    }
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send({ error: { code: "NOT_FOUND", message: "Route not found" } })
  );
  return app;
}
