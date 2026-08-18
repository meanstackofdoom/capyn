import type { FastifyInstance } from "fastify";
import { productionLaunchRequestSchema } from "@capyn/types";
import type { ProductionOnboardingService } from "../domain/production-onboarding-service";
import { InvalidRequestError } from "../http/errors";
import { parseInput } from "../http/validation";

export async function registerOnboardingRoutes(
  app: FastifyInstance,
  service: ProductionOnboardingService
): Promise<void> {
  app.post(
    "/v1/onboarding/launch",
    { config: { rateLimit: { max: 3, timeWindow: "1 hour" } } },
    async (request, reply) => {
      const [scheme, apiKey, extra] = request.headers.authorization?.split(" ") ?? [];
      const idempotencyKey = request.headers["idempotency-key"];
      if (typeof idempotencyKey !== "string") {
        throw new InvalidRequestError(
          "IDEMPOTENCY_KEY_REQUIRED",
          "Idempotency-Key header is required"
        );
      }
      const result = await service.launch(
        scheme === "Bearer" && apiKey && !extra ? apiKey : undefined,
        idempotencyKey,
        parseInput(productionLaunchRequestSchema, request.body)
      );
      return reply.code(result.replayed ? 200 : 201).send(result);
    }
  );
}
