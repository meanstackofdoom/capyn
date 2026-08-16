import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { BootstrapService } from "../domain/bootstrap-service";
import { parseInput } from "../http/validation";

const organisationSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    owner: z
      .object({
        name: z.string().trim().min(1).max(160),
        email: z.string().email().max(320)
      })
      .strict()
  })
  .strict();

export async function registerBootstrapRoutes(app: FastifyInstance, service: BootstrapService): Promise<void> {
  app.post("/v1/organisations", async (request, reply) => {
    const token = request.headers["x-capyn-bootstrap-token"];
    const result = await service.create(
      typeof token === "string" ? token : undefined,
      parseInput(organisationSchema, request.body)
    );
    return reply.code(201).send(result);
  });
}
