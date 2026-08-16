import { generateApiKey, hashApiKey, type CapynRepository } from "@capyn/database";
import {
  moneyToMinorUnits,
  type AgentStatus,
  type DashboardSnapshot,
  type MandateCreateRequest,
  type UserPrincipal
} from "@capyn/types";
import { ConflictError, InvalidRequestError, NotFoundError } from "../http/errors";
import { createId } from "./ids";

export interface CreateAgentRequest {
  name: string;
  slug: string;
  description?: string | undefined;
}

export class ManagementService {
  constructor(
    private readonly repository: CapynRepository,
    private readonly apiKeyPepper: string,
    private readonly clock: () => Date = () => new Date()
  ) {}

  async dashboard(principal: UserPrincipal): Promise<DashboardSnapshot> {
    const snapshot = await this.repository.getDashboardSnapshot(principal.organisationId, this.clock());
    if (!snapshot) throw new NotFoundError("Organisation not found");
    return snapshot;
  }

  async createAgent(principal: UserPrincipal, request: CreateAgentRequest) {
    const now = this.clock();
    const agentId = createId("agt");
    const credentialId = createId("key");
    const generated = generateApiKey("live");
    try {
      await this.repository.transaction(async (tx) => {
        await tx.createAgent({
          id: agentId,
          organisationId: principal.organisationId,
          name: request.name,
          slug: request.slug,
          description: request.description ?? null
        });
        await tx.createCredential({
          id: credentialId,
          agentId,
          keyPrefix: generated.keyPrefix,
          keyHash: hashApiKey(generated.apiKey, this.apiKeyPepper)
        });
        await tx.appendAudit({
          id: createId("evt"),
          organisationId: principal.organisationId,
          actorType: "USER",
          actorId: principal.userId,
          eventType: "AGENT_CREATED",
          entityType: "Agent",
          entityId: agentId,
          timestamp: now,
          metadata: { name: request.name, slug: request.slug }
        });
        await tx.appendAudit({
          id: createId("evt"),
          organisationId: principal.organisationId,
          actorType: "USER",
          actorId: principal.userId,
          eventType: "API_KEY_CREATED",
          entityType: "AgentCredential",
          entityId: credentialId,
          timestamp: now,
          metadata: { agentId, keyPrefix: generated.keyPrefix }
        });
      });
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes("slug")) {
        throw new ConflictError("AGENT_SLUG_EXISTS", "An agent with this slug already exists");
      }
      throw error;
    }
    return {
      agent: { id: agentId, name: request.name, slug: request.slug, status: "ACTIVE" as const },
      credential: { id: credentialId, apiKey: generated.apiKey, keyPrefix: generated.keyPrefix }
    };
  }

  async createCredential(principal: UserPrincipal, agentId: string) {
    const now = this.clock();
    const generated = generateApiKey("live");
    const credentialId = createId("key");
    await this.repository.transaction(async (tx) => {
      const agent = await tx.findAgent(agentId);
      if (!agent || agent.organisationId !== principal.organisationId) throw new NotFoundError("Agent not found");
      await tx.lockAgent(agentId);
      await tx.createCredential({
        id: credentialId,
        agentId,
        keyPrefix: generated.keyPrefix,
        keyHash: hashApiKey(generated.apiKey, this.apiKeyPepper)
      });
      await tx.appendAudit({
        id: createId("evt"),
        organisationId: principal.organisationId,
        actorType: "USER",
        actorId: principal.userId,
        eventType: "API_KEY_CREATED",
        entityType: "AgentCredential",
        entityId: credentialId,
        timestamp: now,
        metadata: { agentId, keyPrefix: generated.keyPrefix }
      });
    });
    return { id: credentialId, apiKey: generated.apiKey, keyPrefix: generated.keyPrefix };
  }

  async revokeCredential(principal: UserPrincipal, agentId: string, credentialId: string): Promise<void> {
    const now = this.clock();
    await this.repository.transaction(async (tx) => {
      const agent = await tx.findAgent(agentId);
      if (!agent || agent.organisationId !== principal.organisationId) throw new NotFoundError("Credential not found");
      const revoked = await tx.revokeCredential(credentialId, agentId, now);
      if (!revoked) throw new NotFoundError("Credential not found");
      await tx.appendAudit({
        id: createId("evt"),
        organisationId: principal.organisationId,
        actorType: "USER",
        actorId: principal.userId,
        eventType: "API_KEY_REVOKED",
        entityType: "AgentCredential",
        entityId: credentialId,
        timestamp: now,
        metadata: { agentId }
      });
    });
  }

  async setAgentStatus(principal: UserPrincipal, agentId: string, status: AgentStatus) {
    const now = this.clock();
    return this.repository.transaction(async (tx) => {
      const agent = await tx.findAgent(agentId);
      if (!agent || agent.organisationId !== principal.organisationId) throw new NotFoundError("Agent not found");
      await tx.lockAgent(agentId);
      const updated = await tx.updateAgentStatus(agentId, status);
      if (status === "REVOKED") await tx.revokeAgentCredentials(agentId, now);
      await tx.appendAudit({
        id: createId("evt"),
        organisationId: principal.organisationId,
        actorType: "USER",
        actorId: principal.userId,
        eventType: status === "SUSPENDED" ? "AGENT_SUSPENDED" : status === "REVOKED" ? "AGENT_REVOKED" : "AGENT_ACTIVATED",
        entityType: "Agent",
        entityId: agentId,
        timestamp: now,
        metadata: { previousStatus: agent.status, status }
      });
      return updated;
    });
  }

  async createMandate(principal: UserPrincipal, request: MandateCreateRequest) {
    const now = this.clock();
    const validUntil = new Date(request.validUntil);
    if (validUntil <= now) throw new InvalidRequestError("INVALID_VALIDITY", "Mandate expiry must be in the future");
    const transaction = BigInt(moneyToMinorUnits(request.limits.perTransaction.value, "USD"));
    const daily = BigInt(moneyToMinorUnits(request.limits.daily.value, "USD"));
    const monthly = BigInt(moneyToMinorUnits(request.limits.monthly.value, "USD"));
    const approval = BigInt(moneyToMinorUnits(request.limits.approvalAbove.value, "USD"));
    if (transaction > daily || daily > monthly || approval > transaction) {
      throw new InvalidRequestError(
        "INVALID_LIMITS",
        "Limits must satisfy approval threshold <= transaction <= daily <= monthly"
      );
    }
    const currencies = new Set([
      request.limits.perTransaction.currency,
      request.limits.daily.currency,
      request.limits.monthly.currency,
      request.limits.approvalAbove.currency
    ]);
    if (currencies.size !== 1 || !currencies.has("USD")) {
      throw new InvalidRequestError("CURRENCY_MISMATCH", "Every mandate limit must use USD");
    }
    const capabilities = [...new Set(request.capabilities)];
    const vendors = [...new Map(request.allowedVendors.map((vendor) => [vendor.id.toLowerCase(), vendor])).values()];
    const mandateId = createId("man");
    return this.repository.transaction(async (tx) => {
      const agent = await tx.findAgent(request.agentId);
      if (!agent || agent.organisationId !== principal.organisationId) throw new NotFoundError("Agent not found");
      await tx.lockAgent(agent.id);
      const mandate = await tx.createActiveMandate({
        id: mandateId,
        policyId: createId("pol"),
        organisationId: principal.organisationId,
        agentId: agent.id,
        name: request.name,
        validFrom: now,
        validUntil,
        createdBy: principal.userId,
        capabilities,
        allowedVendors: vendors.map((vendor) => ({ id: vendor.id.toLowerCase(), name: vendor.name ?? null })),
        currency: "USD",
        perTransactionLimitMinor: transaction.toString(),
        dailyLimitMinor: daily.toString(),
        monthlyLimitMinor: monthly.toString(),
        approvalThresholdMinor: approval.toString()
      });
      await tx.appendAudit({
        id: createId("evt"),
        organisationId: principal.organisationId,
        actorType: "USER",
        actorId: principal.userId,
        eventType: "MANDATE_ACTIVATED",
        entityType: "Mandate",
        entityId: mandate.id,
        timestamp: now,
        metadata: { agentId: agent.id, version: mandate.version, capabilities }
      });
      return mandate;
    });
  }

  async revokeMandate(principal: UserPrincipal, agentId: string): Promise<void> {
    const now = this.clock();
    await this.repository.transaction(async (tx) => {
      const agent = await tx.findAgent(agentId);
      if (!agent || agent.organisationId !== principal.organisationId) throw new NotFoundError("Agent not found");
      await tx.lockAgent(agentId);
      const count = await tx.revokeActiveMandates(agentId, now);
      if (count === 0) throw new NotFoundError("Active mandate not found");
      await tx.appendAudit({
        id: createId("evt"),
        organisationId: principal.organisationId,
        actorType: "USER",
        actorId: principal.userId,
        eventType: "MANDATE_REVOKED",
        entityType: "Agent",
        entityId: agentId,
        timestamp: now,
        metadata: { revokedMandates: count }
      });
    });
  }
}
