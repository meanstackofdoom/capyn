import { timingSafeEqual } from "node:crypto";
import type { CapynRepository } from "@capyn/database";
import { AuthenticationError, ConflictError } from "../http/errors";
import { createId } from "./ids";

export interface CreateOrganisationRequest {
  name: string;
  slug: string;
  owner: { name: string; email: string };
}

function constantTimeMatches(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export class BootstrapService {
  constructor(
    private readonly repository: CapynRepository,
    private readonly configuredToken: string | undefined,
    private readonly clock: () => Date = () => new Date()
  ) {}

  async create(token: string | undefined, request: CreateOrganisationRequest) {
    if (!this.configuredToken || !token || !constantTimeMatches(token, this.configuredToken)) {
      throw new AuthenticationError("A valid bootstrap token is required");
    }
    const organisationId = createId("org");
    const ownerId = createId("usr");
    try {
      return await this.repository.transaction(async (tx) => {
        const result = await tx.createOrganisation({
          organisation: { id: organisationId, name: request.name, slug: request.slug },
          owner: { id: ownerId, name: request.owner.name, email: request.owner.email.toLowerCase() }
        });
        await tx.appendAudit({
          id: createId("evt"),
          organisationId,
          actorType: "USER",
          actorId: ownerId,
          eventType: "ORGANISATION_CREATED",
          entityType: "Organisation",
          entityId: organisationId,
          timestamp: this.clock(),
          metadata: { name: request.name, slug: request.slug }
        });
        return result;
      });
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes("unique")) {
        throw new ConflictError("ORGANISATION_SLUG_EXISTS", "An organisation with this slug already exists");
      }
      throw error;
    }
  }
}
