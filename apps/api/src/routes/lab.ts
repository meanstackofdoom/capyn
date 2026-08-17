import type { FastifyInstance } from "fastify";
import { labApprovalDecisionSchema, labEvaluateRequestSchema } from "@capyn/types";
import type { LabService } from "../domain/lab-service";
import { parseInput } from "../http/validation";

export async function registerLabRoutes(app: FastifyInstance, lab: LabService): Promise<void> {
  app.post(
    "/v1/lab/evaluate",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const input = parseInput(labEvaluateRequestSchema, request.body);
      const result = lab.evaluate(input);
      return reply.code(result.decision === "REQUIRE_APPROVAL" ? 202 : 200).send(result);
    }
  );

  app.post<{ Params: { id: string } }>(
    "/v1/lab/approvals/:id",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request) => {
      const input = parseInput(labApprovalDecisionSchema, request.body);
      return lab.resolve(request.params.id, input);
    }
  );
}
