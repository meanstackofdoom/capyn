import type { FastifyInstance } from "fastify";
import { authorizeRequestSchema } from "@capyn/types";
import type { AuthAdapter } from "../http/auth";
import { InvalidRequestError } from "../http/errors";
import { parseInput } from "../http/validation";
import type { AuthorizationService } from "../domain/authorization-service";
import type { ExecutionService } from "../domain/execution-service";

interface AgentRouteDependencies {
  auth: AuthAdapter;
  authorizations: AuthorizationService;
  executions: ExecutionService;
}

export async function registerAgentRoutes(app: FastifyInstance, dependencies: AgentRouteDependencies): Promise<void> {
  app.get("/v1/me", async (request) => {
    const principal = await dependencies.auth.authenticateAgent(request);
    return dependencies.authorizations.getMe(principal);
  });

  app.get("/v1/mandate", async (request) => {
    const principal = await dependencies.auth.authenticateAgent(request);
    return { mandate: await dependencies.authorizations.getMandate(principal) };
  });

  app.post(
    "/v1/authorize",
    { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const principal = await dependencies.auth.authenticateAgent(request);
      const body = parseInput(authorizeRequestSchema, request.body);
      const idempotencyHeader = request.headers["idempotency-key"];
      if (typeof idempotencyHeader !== "string") {
        throw new InvalidRequestError("IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required");
      }
      const result = await dependencies.authorizations.authorize(principal, body, idempotencyHeader);
      return reply.code(result.decision === "REQUIRE_APPROVAL" ? 202 : 200).send(result);
    }
  );

  app.get<{ Params: { id: string } }>("/v1/authorizations/:id", async (request) => {
    const principal = await dependencies.auth.authenticateAgent(request);
    return dependencies.authorizations.getAuthorization(principal, request.params.id);
  });

  app.post<{ Params: { id: string } }>(
    "/v1/authorizations/:id/execute",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request) => {
      const principal = await dependencies.auth.authenticateAgent(request);
      return dependencies.executions.execute(principal, request.params.id);
    }
  );
}
