import type { FastifyRequest } from "fastify";
import { hashApiKey, type CapynRepository } from "@capyn/database";
import type { AgentPrincipal, UserPrincipal, UserRole } from "@capyn/types";
import { AuthenticationError, AuthorizationError } from "./errors";

export interface AuthAdapter {
  authenticateAgent(request: FastifyRequest): Promise<AgentPrincipal>;
  authenticateUser(request: FastifyRequest): Promise<UserPrincipal>;
}

export class RepositoryAuthAdapter implements AuthAdapter {
  constructor(
    private readonly repository: CapynRepository,
    private readonly apiKeyPepper: string,
    private readonly allowDemoHumanHeader: boolean,
    private readonly demoHumanUserId?: string
  ) {}

  async authenticateAgent(request: FastifyRequest): Promise<AgentPrincipal> {
    const authorization = request.headers.authorization;
    const [scheme, apiKey, extra] = authorization?.split(" ") ?? [];
    if (scheme !== "Bearer" || !apiKey || extra || !apiKey.startsWith("capyn_")) {
      throw new AuthenticationError("A valid CAPYN agent API key is required");
    }
    const credential = await this.repository.findCredentialByHash(hashApiKey(apiKey, this.apiKeyPepper));
    if (!credential || credential.revokedAt) {
      throw new AuthenticationError("A valid CAPYN agent API key is required");
    }
    await this.repository.touchCredential(credential.id, new Date());
    return {
      type: "AGENT",
      organisationId: credential.organisationId,
      agentId: credential.agentId,
      credentialId: credential.id
    };
  }

  async authenticateUser(request: FastifyRequest): Promise<UserPrincipal> {
    if (!this.allowDemoHumanHeader) {
      throw new AuthenticationError("No human authentication adapter is configured");
    }
    const userId = request.headers["x-capyn-user-id"];
    if (typeof userId !== "string" || !userId) {
      throw new AuthenticationError("The x-capyn-user-id demo header is required");
    }
    if (this.demoHumanUserId && userId !== this.demoHumanUserId) {
      throw new AuthenticationError("A valid human user is required");
    }
    const user = await this.repository.findUser(userId);
    if (!user) throw new AuthenticationError("A valid human user is required");
    return {
      type: "USER",
      organisationId: user.organisationId,
      userId: user.id,
      role: user.role
    };
  }
}

export function requireRole(principal: UserPrincipal, roles: readonly UserRole[]): void {
  if (!roles.includes(principal.role)) throw new AuthorizationError();
}
