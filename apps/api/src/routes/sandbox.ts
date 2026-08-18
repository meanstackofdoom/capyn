import type { FastifyInstance } from "fastify";
import { labEvaluateRequestSchema, sandboxActivateRequestSchema } from "@capyn/types";
import type { SandboxService } from "../domain/sandbox-service";
import { parseInput } from "../http/validation";

function bearerCredential(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const parts = header.split(" ");
  if (parts.length !== 2 || parts[0]?.toLowerCase() !== "bearer") return undefined;
  return parts[1];
}

export async function registerSandboxRoutes(app: FastifyInstance, sandbox: SandboxService): Promise<void> {
  app.post(
    "/v1/sandbox/activate",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const input = parseInput(sandboxActivateRequestSchema, request.body);
      return reply.code(201).send(sandbox.activate(input));
    }
  );

  app.post(
    "/v1/sandbox/authorize",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const input = parseInput(labEvaluateRequestSchema, request.body);
      const result = sandbox.authorize(bearerCredential(request.headers.authorization), input);
      return reply.code(result.decision === "REQUIRE_APPROVAL" ? 202 : 200).send(result);
    }
  );
}
