import type { FastifyInstance } from "fastify";
import { billingCheckoutSchema } from "@capyn/types";
import type { BillingService } from "../domain/billing-service";
import type { AuthAdapter } from "../http/auth";
import { InvalidRequestError } from "../http/errors";
import { parseInput } from "../http/validation";

interface BillingRouteDependencies {
  auth: AuthAdapter;
  billing: BillingService;
}

export async function registerBillingRoutes(
  app: FastifyInstance,
  dependencies: BillingRouteDependencies
): Promise<void> {
  app.get("/v1/billing", async (request) => {
    const principal = await dependencies.auth.authenticateUser(request);
    return dependencies.billing.overview(principal);
  });

  app.post("/v1/billing/checkout", async (request, reply) => {
    const principal = await dependencies.auth.authenticateUser(request);
    const body = parseInput(billingCheckoutSchema, request.body);
    const idempotencyKey = request.headers["idempotency-key"];
    if (typeof idempotencyKey !== "string") {
      throw new InvalidRequestError("IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required");
    }
    return reply.code(201).send(await dependencies.billing.createCheckout(principal, body.planId, idempotencyKey));
  });

  app.post("/v1/billing/portal", async (request, reply) => {
    const principal = await dependencies.auth.authenticateUser(request);
    return reply.code(201).send(await dependencies.billing.createPortal(principal));
  });

  app.register(async (webhookScope) => {
    webhookScope.removeContentTypeParser("application/json");
    webhookScope.addContentTypeParser(
      "application/json",
      { parseAs: "buffer", bodyLimit: 256 * 1024 },
      (_request, body, done) => done(null, body)
    );
    webhookScope.post("/v1/billing/webhooks/stripe", async (request) => {
      const signature = request.headers["stripe-signature"];
      return dependencies.billing.processWebhook(
        Buffer.isBuffer(request.body) ? request.body : Buffer.from(""),
        typeof signature === "string" ? signature : undefined
      );
    });
  });
}
