import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  AGENT_STATUSES,
  approvalDecisionSchema,
  mandateCreateSchema
} from "@capyn/types";
import type { ApprovalService } from "../domain/approval-service";
import type { ManagementService } from "../domain/management-service";
import type { AuthAdapter } from "../http/auth";
import { requireRole } from "../http/auth";
import { InvalidRequestError } from "../http/errors";
import { parseInput } from "../http/validation";

const agentCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    description: z.string().trim().max(500).optional()
  })
  .strict();

const statusSchema = z.object({ status: z.enum(AGENT_STATUSES) }).strict();

interface ManagementRouteDependencies {
  auth: AuthAdapter;
  approvals: ApprovalService;
  management: ManagementService;
}

export async function registerManagementRoutes(
  app: FastifyInstance,
  dependencies: ManagementRouteDependencies
): Promise<void> {
  app.get("/v1/dashboard", async (request) => {
    const principal = await dependencies.auth.authenticateUser(request);
    return dependencies.management.dashboard(principal);
  });

  app.post("/v1/agents", async (request, reply) => {
    const principal = await dependencies.auth.authenticateUser(request);
    requireRole(principal, ["OWNER", "ADMIN"]);
    const result = await dependencies.management.createAgent(principal, parseInput(agentCreateSchema, request.body));
    return reply.code(201).send(result);
  });

  app.patch<{ Params: { id: string } }>("/v1/agents/:id/status", async (request) => {
    const principal = await dependencies.auth.authenticateUser(request);
    requireRole(principal, ["OWNER", "ADMIN"]);
    const body = parseInput(statusSchema, request.body);
    return dependencies.management.setAgentStatus(principal, request.params.id, body.status);
  });

  app.post<{ Params: { id: string } }>("/v1/agents/:id/credentials", async (request, reply) => {
    const principal = await dependencies.auth.authenticateUser(request);
    requireRole(principal, ["OWNER", "ADMIN"]);
    return reply.code(201).send(await dependencies.management.createCredential(principal, request.params.id));
  });

  app.post<{ Params: { agentId: string; credentialId: string } }>(
    "/v1/agents/:agentId/credentials/:credentialId/rotate",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const principal = await dependencies.auth.authenticateUser(request);
      requireRole(principal, ["OWNER", "ADMIN"]);
      const idempotencyKey = request.headers["idempotency-key"];
      if (typeof idempotencyKey !== "string") {
        throw new InvalidRequestError("IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required");
      }
      const result = await dependencies.management.rotateCredential(
        principal,
        request.params.agentId,
        request.params.credentialId,
        idempotencyKey
      );
      return reply.code(201).send(result);
    }
  );

  app.delete<{ Params: { agentId: string; credentialId: string } }>(
    "/v1/agents/:agentId/credentials/:credentialId",
    async (request, reply) => {
      const principal = await dependencies.auth.authenticateUser(request);
      requireRole(principal, ["OWNER", "ADMIN"]);
      await dependencies.management.revokeCredential(
        principal,
        request.params.agentId,
        request.params.credentialId
      );
      return reply.code(204).send();
    }
  );

  app.post("/v1/mandates", async (request, reply) => {
    const principal = await dependencies.auth.authenticateUser(request);
    requireRole(principal, ["OWNER", "ADMIN"]);
    const mandate = await dependencies.management.createMandate(
      principal,
      parseInput(mandateCreateSchema, request.body)
    );
    return reply.code(201).send(mandate);
  });

  app.delete<{ Params: { agentId: string } }>("/v1/agents/:agentId/mandate", async (request, reply) => {
    const principal = await dependencies.auth.authenticateUser(request);
    requireRole(principal, ["OWNER", "ADMIN"]);
    await dependencies.management.revokeMandate(principal, request.params.agentId);
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string } }>("/v1/approvals/:id/decision", async (request) => {
    const principal = await dependencies.auth.authenticateUser(request);
    requireRole(principal, ["OWNER", "ADMIN", "APPROVER"]);
    return dependencies.approvals.decide(principal, request.params.id, parseInput(approvalDecisionSchema, request.body));
  });
}
