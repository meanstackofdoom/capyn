import {
  minorUnitsToMoney,
  type AgentStatus,
  type ApprovalView,
  type AuditEventView,
  type AuthorizationState,
  type DashboardSnapshot,
  type MandatePolicyContext
} from "@capyn/types";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { deserialize, serialize } from "node:v8";
import type {
  AgentRecord,
  AppendAuditEvent,
  CapynRepository,
  CapynTransaction,
  CreateAgentRecord,
  CreateApprovalRecord,
  CreateAuthorizationRecord,
  CreateCredentialRecord,
  CreateExecutionRecord,
  CreateMandateRecord,
  CreateOrganisationRecord,
  CreateProductionLaunchRecord,
  CreateUserCredentialRecord,
  CredentialAuthRecord,
  BillingAccountRecord,
  BillingAllowance,
  DemoSeedIds,
  RecordBillingUsage,
  RecordBillingWebhook,
  ProductionLaunchRecord,
  StoredCredential,
  StoredApproval,
  StoredAuthorization,
  StoredExecution,
  StoredSubscription,
  UpdateSubscriptionRecord,
  UserAuthRecord,
  UserCredentialAuthRecord
} from "./contracts";

interface MemoryOrganisation {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
}

interface MemoryCredential {
  id: string;
  agentId: string;
  keyPrefix: string;
  keyHash: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  rotationIdempotencyKey: string | null;
  rotatedFromId: string | null;
}

interface MemoryUserCredential {
  id: string;
  userId: string;
  keyPrefix: string;
  keyHash: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

interface MemoryMandate extends MandatePolicyContext {
  organisationId: string;
  agentId: string;
  createdBy: string;
  createdAt: Date;
  revokedAt: Date | null;
}

export interface MemoryState {
  organisations: MemoryOrganisation[];
  users: UserAuthRecord[];
  userCredentials: MemoryUserCredential[];
  agents: AgentRecord[];
  credentials: MemoryCredential[];
  mandates: MemoryMandate[];
  authorizations: StoredAuthorization[];
  approvals: StoredApproval[];
  executions: StoredExecution[];
  auditEvents: AppendAuditEvent[];
  subscriptions: StoredSubscription[];
  billingUsageEvents: RecordBillingUsage[];
  billingWebhookEvents: RecordBillingWebhook[];
  productionLaunches: ProductionLaunchRecord[];
}

function blankState(): MemoryState {
  return {
    organisations: [],
    users: [],
    userCredentials: [],
    agents: [],
    credentials: [],
    mandates: [],
    authorizations: [],
    approvals: [],
    executions: [],
    auditEvents: [],
    subscriptions: [],
    billingUsageEvents: [],
    billingWebhookEvents: [],
    productionLaunches: []
  };
}

function utcDayStart(now: Date): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

function utcMonthStart(now: Date): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
}

function isReserved(auth: StoredAuthorization, now: Date): boolean {
  if (auth.state === "EXECUTING" || auth.state === "EXECUTED") return true;
  return (auth.state === "ALLOWED" || auth.state === "APPROVED") && Boolean(auth.expiresAt && auth.expiresAt > now);
}

function cloneAuthorization(auth: StoredAuthorization): StoredAuthorization {
  return structuredClone(auth);
}

export class InMemoryCapynRepository implements CapynRepository, CapynTransaction {
  protected state: MemoryState;
  private transactionQueue: Promise<void> = Promise.resolve();

  constructor(initial?: MemoryState) {
    this.state = initial ? structuredClone(initial) : blankState();
  }

  async findCredentialByHash(keyHash: string): Promise<CredentialAuthRecord | null> {
    const credential = this.state.credentials.find((item) => item.keyHash === keyHash);
    if (!credential) return null;
    const agent = this.state.agents.find((item) => item.id === credential.agentId);
    if (!agent) return null;
    return {
      id: credential.id,
      keyHash: credential.keyHash,
      organisationId: agent.organisationId,
      agentId: agent.id,
      revokedAt: credential.revokedAt
    };
  }

  async touchCredential(id: string, at: Date): Promise<void> {
    const credential = this.state.credentials.find((item) => item.id === id && item.revokedAt === null);
    if (credential) credential.lastUsedAt = at;
  }

  async findUser(id: string): Promise<UserAuthRecord | null> {
    return structuredClone(this.state.users.find((item) => item.id === id) ?? null);
  }

  async findUserCredentialByHash(keyHash: string): Promise<UserCredentialAuthRecord | null> {
    const credential = this.state.userCredentials.find((item) => item.keyHash === keyHash);
    if (!credential) return null;
    const user = this.state.users.find((item) => item.id === credential.userId);
    if (!user) return null;
    return {
      id: credential.id,
      keyHash: credential.keyHash,
      userId: user.id,
      organisationId: user.organisationId,
      role: user.role,
      revokedAt: credential.revokedAt
    };
  }

  async touchUserCredential(id: string, at: Date): Promise<void> {
    const credential = this.state.userCredentials.find((item) => item.id === id && item.revokedAt === null);
    if (credential) credential.lastUsedAt = at;
  }

  async transaction<T>(work: (tx: CapynTransaction) => Promise<T>): Promise<T> {
    let release: (() => void) | undefined;
    const waitForTurn = this.transactionQueue;
    this.transactionQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await waitForTurn;
    const before = structuredClone(this.state);
    try {
      return await work(this);
    } catch (error) {
      this.state = before;
      throw error;
    } finally {
      release?.();
    }
  }

  async lockAgent(_agentId: string): Promise<void> {
    // The repository-wide transaction mutex is stronger than a per-agent lock.
  }

  async lockOrganisation(_organisationId: string): Promise<void> {
    // The repository-wide transaction mutex is stronger than an organisation lock.
  }

  async findAgent(agentId: string): Promise<AgentRecord | null> {
    return structuredClone(this.state.agents.find((item) => item.id === agentId) ?? null);
  }

  async findCredential(agentId: string, credentialId: string): Promise<StoredCredential | null> {
    const credential = this.state.credentials.find(
      (item) => item.agentId === agentId && item.id === credentialId
    );
    return credential ? structuredClone(credential) : null;
  }

  async findCredentialRotation(agentId: string, idempotencyKey: string): Promise<StoredCredential | null> {
    const credential = this.state.credentials.find(
      (item) => item.agentId === agentId && item.rotationIdempotencyKey === idempotencyKey
    );
    return credential ? structuredClone(credential) : null;
  }

  async findIdempotentAuthorization(agentId: string, idempotencyKey: string): Promise<StoredAuthorization | null> {
    const item = this.state.authorizations.find(
      (authorization) => authorization.agentId === agentId && authorization.idempotencyKey === idempotencyKey
    );
    return item ? cloneAuthorization(item) : null;
  }

  async loadPolicyContext(agentId: string, _currency: "USD", now: Date) {
    const agent = this.state.agents.find((item) => item.id === agentId);
    if (!agent) throw new Error("Agent not found");
    const mandates = this.state.mandates
      .filter((item) => item.agentId === agentId && item.status === "ACTIVE")
      .sort((left, right) => right.version - left.version);
    const applicable = this.state.authorizations.filter(
      (item) => item.agentId === agentId && item.currency === "USD" && isReserved(item, now)
    );
    const dayStart = utcDayStart(now);
    const monthStart = utcMonthStart(now);
    const daily = applicable
      .filter((item) => item.createdAt.getTime() >= dayStart)
      .reduce((sum, item) => sum + BigInt(item.amountMinor), 0n);
    const monthly = applicable
      .filter((item) => item.createdAt.getTime() >= monthStart)
      .reduce((sum, item) => sum + BigInt(item.amountMinor), 0n);
    const mandate = mandates[0] ?? null;
    return {
      now: now.toISOString(),
      agent: { id: agent.id, status: agent.status },
      activeMandateCount: mandates.length,
      mandate: mandate
        ? {
            id: mandate.id,
            name: mandate.name,
            version: mandate.version,
            status: mandate.status,
            validFrom: mandate.validFrom,
            validUntil: mandate.validUntil,
            capabilities: [...mandate.capabilities],
            policy: mandate.policy ? structuredClone(mandate.policy) : null
          }
        : null,
      spend: { dailyMinor: daily.toString(), monthlyMinor: monthly.toString() }
    };
  }

  async createAuthorization(input: CreateAuthorizationRecord): Promise<StoredAuthorization> {
    if (
      this.state.authorizations.some(
        (item) => item.agentId === input.agentId && item.idempotencyKey === input.idempotencyKey
      )
    ) {
      throw new Error("Duplicate idempotency key");
    }
    const agent = this.state.agents.find((item) => item.id === input.agentId);
    if (!agent) throw new Error("Agent not found");
    const now = new Date();
    const record: StoredAuthorization = {
      ...structuredClone(input),
      agentName: agent.name,
      approvalId: null,
      createdAt: now,
      updatedAt: now
    };
    this.state.authorizations.push(record);
    return cloneAuthorization(record);
  }

  async findAuthorization(id: string): Promise<StoredAuthorization | null> {
    const item = this.state.authorizations.find((authorization) => authorization.id === id);
    return item ? cloneAuthorization(item) : null;
  }

  async updateAuthorization(
    id: string,
    update: { state: AuthorizationState; expiresAt?: Date | null }
  ): Promise<StoredAuthorization> {
    const item = this.state.authorizations.find((authorization) => authorization.id === id);
    if (!item) throw new Error("Authorization not found");
    item.state = update.state;
    if ("expiresAt" in update) item.expiresAt = update.expiresAt ?? null;
    item.updatedAt = new Date();
    return cloneAuthorization(item);
  }

  async createApproval(input: CreateApprovalRecord): Promise<StoredApproval> {
    const record: StoredApproval = {
      ...input,
      status: "PENDING",
      requestedAt: new Date(),
      decidedAt: null,
      decidedBy: null,
      comment: null
    };
    this.state.approvals.push(record);
    const authorization = this.state.authorizations.find((item) => item.id === input.authorizationId);
    if (authorization) authorization.approvalId = input.id;
    return structuredClone(record);
  }

  async findApproval(id: string): Promise<StoredApproval | null> {
    return structuredClone(this.state.approvals.find((item) => item.id === id) ?? null);
  }

  async updateApproval(
    id: string,
    update: {
      status: "APPROVED" | "REJECTED" | "EXPIRED";
      decidedAt: Date;
      decidedBy: string | null;
      comment: string | null;
    }
  ): Promise<StoredApproval> {
    const item = this.state.approvals.find((approval) => approval.id === id);
    if (!item) throw new Error("Approval not found");
    Object.assign(item, update);
    return structuredClone(item);
  }

  async findExecutionByAuthorization(authorizationId: string): Promise<StoredExecution | null> {
    return structuredClone(this.state.executions.find((item) => item.authorizationId === authorizationId) ?? null);
  }

  async findStaleExecutions(now: Date, limit: number): Promise<StoredExecution[]> {
    const stale = this.state.executions
      .filter(
        (execution) =>
          execution.status === "PENDING" &&
          execution.leaseExpiresAt !== null &&
          execution.leaseExpiresAt <= now
      )
      .sort((left, right) => left.lastAttemptAt.getTime() - right.lastAttemptAt.getTime());
    return structuredClone(stale.slice(0, limit));
  }

  async createExecution(input: CreateExecutionRecord): Promise<StoredExecution> {
    if (this.state.executions.some((item) => item.authorizationId === input.authorizationId)) {
      throw new Error("Execution already exists");
    }
    const record: StoredExecution = {
      id: input.id,
      organisationId: input.organisationId,
      authorizationId: input.authorizationId,
      provider: input.provider,
      status: "PENDING",
      externalReference: null,
      errorCode: null,
      attemptCount: 1,
      lastAttemptAt: input.attemptedAt,
      leaseExpiresAt: input.leaseExpiresAt,
      createdAt: new Date(),
      completedAt: null
    };
    this.state.executions.push(record);
    return structuredClone(record);
  }

  async claimExecutionRecovery(
    id: string,
    attemptedAt: Date,
    leaseExpiresAt: Date
  ): Promise<StoredExecution | null> {
    const item = this.state.executions.find((execution) => execution.id === id);
    if (
      !item ||
      item.status !== "PENDING" ||
      (item.leaseExpiresAt !== null && item.leaseExpiresAt > attemptedAt)
    ) {
      return null;
    }
    item.attemptCount += 1;
    item.lastAttemptAt = attemptedAt;
    item.leaseExpiresAt = leaseExpiresAt;
    item.errorCode = null;
    return structuredClone(item);
  }

  async markExecutionUncertain(
    id: string,
    expectedAttemptCount: number,
    update: {
      externalReference: string | null;
      errorCode: string;
      leaseExpiresAt: Date;
    }
  ): Promise<StoredExecution | null> {
    const item = this.state.executions.find((execution) => execution.id === id);
    if (!item || item.status !== "PENDING" || item.attemptCount !== expectedAttemptCount) return null;
    Object.assign(item, update);
    return structuredClone(item);
  }

  async completeExecution(
    id: string,
    expectedAttemptCount: number,
    update: {
      status: "EXECUTED" | "FAILED";
      externalReference: string | null;
      errorCode: string | null;
      completedAt: Date;
    }
  ): Promise<StoredExecution | null> {
    const item = this.state.executions.find((execution) => execution.id === id);
    if (!item || item.status !== "PENDING" || item.attemptCount !== expectedAttemptCount) return null;
    Object.assign(item, update);
    item.leaseExpiresAt = null;
    return structuredClone(item);
  }

  async appendAudit(input: AppendAuditEvent): Promise<void> {
    this.state.auditEvents.push(structuredClone(input));
  }

  async createAgent(input: CreateAgentRecord): Promise<AgentRecord> {
    if (this.state.agents.some((agent) => agent.organisationId === input.organisationId && agent.slug === input.slug)) {
      throw new Error("Agent slug already exists");
    }
    const record: AgentRecord = { ...input, status: "ACTIVE", createdAt: new Date() };
    this.state.agents.push(record);
    return structuredClone(record);
  }

  async updateAgentStatus(agentId: string, status: AgentStatus): Promise<AgentRecord> {
    const agent = this.state.agents.find((item) => item.id === agentId);
    if (!agent) throw new Error("Agent not found");
    agent.status = status;
    return structuredClone(agent);
  }

  async createCredential(input: CreateCredentialRecord): Promise<void> {
    this.state.credentials.push({
      ...input,
      rotationIdempotencyKey: input.rotationIdempotencyKey ?? null,
      rotatedFromId: input.rotatedFromId ?? null,
      createdAt: new Date(),
      lastUsedAt: null,
      revokedAt: null
    });
  }

  async createUserCredential(input: CreateUserCredentialRecord): Promise<void> {
    if (this.state.userCredentials.some((item) => item.keyHash === input.keyHash)) {
      throw new Error("User credential key hash must be unique");
    }
    this.state.userCredentials.push({
      ...input,
      createdAt: new Date(),
      lastUsedAt: null,
      revokedAt: null
    });
  }

  async revokeCredential(credentialId: string, agentId: string, at: Date): Promise<boolean> {
    const item = this.state.credentials.find(
      (credential) => credential.id === credentialId && credential.agentId === agentId && credential.revokedAt === null
    );
    if (!item) return false;
    item.revokedAt = at;
    return true;
  }

  async revokeAgentCredentials(agentId: string, at: Date): Promise<number> {
    let count = 0;
    for (const credential of this.state.credentials) {
      if (credential.agentId === agentId && credential.revokedAt === null) {
        credential.revokedAt = at;
        count += 1;
      }
    }
    return count;
  }

  async createActiveMandate(input: CreateMandateRecord): Promise<{ id: string; version: number }> {
    const versions = this.state.mandates.filter((item) => item.agentId === input.agentId).map((item) => item.version);
    const version = Math.max(0, ...versions) + 1;
    for (const item of this.state.mandates) {
      if (item.agentId === input.agentId && item.status === "ACTIVE") {
        item.status = "REVOKED";
        item.revokedAt = input.validFrom;
      }
    }
    this.state.mandates.push({
      id: input.id,
      organisationId: input.organisationId,
      agentId: input.agentId,
      name: input.name,
      version,
      status: "ACTIVE",
      validFrom: input.validFrom.toISOString(),
      validUntil: input.validUntil.toISOString(),
      capabilities: [...input.capabilities],
      policy: {
        currency: input.currency,
        allowedVendorIds: input.allowedVendors.map((vendor) => vendor.id),
        perTransactionLimitMinor: input.perTransactionLimitMinor,
        dailyLimitMinor: input.dailyLimitMinor,
        monthlyLimitMinor: input.monthlyLimitMinor,
        approvalThresholdMinor: input.approvalThresholdMinor
      },
      createdBy: input.createdBy,
      createdAt: new Date(),
      revokedAt: null
    });
    return { id: input.id, version };
  }

  async revokeActiveMandates(agentId: string, at: Date): Promise<number> {
    let count = 0;
    for (const mandate of this.state.mandates) {
      if (mandate.agentId === agentId && mandate.status === "ACTIVE") {
        mandate.status = "REVOKED";
        mandate.revokedAt = at;
        count += 1;
      }
    }
    return count;
  }

  async createOrganisation(input: CreateOrganisationRecord): Promise<{ organisationId: string; ownerId: string }> {
    if (this.state.organisations.some((item) => item.slug === input.organisation.slug)) {
      throw new Error("Organisation slug unique constraint");
    }
    this.state.organisations.push({ ...input.organisation, createdAt: new Date() });
    this.state.users.push({
      ...input.owner,
      organisationId: input.organisation.id,
      role: "OWNER"
    });
    this.state.subscriptions.push({
      id: input.subscription.id,
      organisationId: input.organisation.id,
      planId: "DEVELOPER",
      status: "ACTIVE",
      provider: "INTERNAL",
      providerCustomerId: null,
      providerSubscriptionId: null,
      currentPeriodStart: input.subscription.currentPeriodStart,
      currentPeriodEnd: input.subscription.currentPeriodEnd,
      cancelAtPeriodEnd: false
    });
    return { organisationId: input.organisation.id, ownerId: input.owner.id };
  }

  async findProductionLaunchBySandboxHash(sandboxCredentialHash: string): Promise<ProductionLaunchRecord | null> {
    return structuredClone(
      this.state.productionLaunches.find((item) => item.sandboxCredentialHash === sandboxCredentialHash) ?? null
    );
  }

  async createProductionLaunch(input: CreateProductionLaunchRecord): Promise<ProductionLaunchRecord> {
    if (this.state.productionLaunches.some((item) => item.sandboxCredentialHash === input.sandboxCredentialHash)) {
      throw new Error("Sandbox credential launch must be unique");
    }
    const record = { ...structuredClone(input), createdAt: new Date() };
    this.state.productionLaunches.push(record);
    return structuredClone(record);
  }

  async getBillingAllowance(organisationId: string, now: Date): Promise<BillingAllowance> {
    const subscription = this.state.subscriptions.find((item) => item.organisationId === organisationId);
    if (!subscription) throw new Error("Organisation subscription not found");
    if (
      subscription.planId === "DEVELOPER" &&
      (now < subscription.currentPeriodStart || now >= subscription.currentPeriodEnd)
    ) {
      subscription.currentPeriodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      subscription.currentPeriodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    }
    const inPeriod = (event: RecordBillingUsage) =>
      event.organisationId === organisationId &&
      event.occurredAt >= subscription.currentPeriodStart &&
      event.occurredAt < subscription.currentPeriodEnd;
    const authorizationDecisions = this.state.billingUsageEvents
      .filter((event) => inPeriod(event) && event.metric === "AUTHORIZATION_DECISION")
      .reduce((sum, event) => sum + Number(event.quantity), 0);
    return {
      subscription: structuredClone(subscription),
      activeAgents: this.state.agents.filter(
        (agent) => agent.organisationId === organisationId && agent.status === "ACTIVE"
      ).length,
      authorizationDecisions
    };
  }

  async recordBillingUsage(input: RecordBillingUsage): Promise<void> {
    const duplicate = this.state.billingUsageEvents.some(
      (event) =>
        event.organisationId === input.organisationId &&
        event.metric === input.metric &&
        event.sourceType === input.sourceType &&
        event.sourceId === input.sourceId
    );
    if (!duplicate) this.state.billingUsageEvents.push(structuredClone(input));
  }

  async updateSubscription(input: UpdateSubscriptionRecord): Promise<StoredSubscription> {
    const subscription = this.state.subscriptions.find((item) => item.organisationId === input.organisationId);
    if (!subscription) throw new Error("Organisation subscription not found");
    Object.assign(subscription, input, { planId: input.planId });
    return structuredClone(subscription);
  }

  async recordBillingWebhook(input: RecordBillingWebhook): Promise<boolean> {
    if (
      this.state.billingWebhookEvents.some(
        (event) => event.provider === input.provider && event.providerEventId === input.providerEventId
      )
    ) return false;
    this.state.billingWebhookEvents.push(structuredClone(input));
    return true;
  }

  async getDashboardSnapshot(organisationId: string, now: Date): Promise<DashboardSnapshot | null> {
    const organisation = this.state.organisations.find((item) => item.id === organisationId);
    if (!organisation) return null;
    const agents = this.state.agents.filter((item) => item.organisationId === organisationId);
    const authorizations = this.state.authorizations
      .filter((item) => item.organisationId === organisationId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
    const dayStart = utcDayStart(now);
    const monthStart = utcMonthStart(now);
    const reserved = authorizations.filter((item) => isReserved(item, now));
    const toApprovalView = (approval: StoredApproval): ApprovalView | null => {
      const auth = this.state.authorizations.find((item) => item.id === approval.authorizationId);
      if (!auth) return null;
      const mandate = this.state.mandates.find((item) => item.id === auth.mandateId);
      return {
        id: approval.id,
        authorizationId: auth.id,
        status: approval.status,
        agentId: auth.agentId,
        agentName: auth.agentName,
        capability: auth.capability,
        vendor: { id: auth.vendorId, name: auth.vendorName },
        amount: { value: minorUnitsToMoney(auth.amountMinor), currency: "USD" },
        purpose: typeof auth.metadata.purpose === "string" ? auth.metadata.purpose : null,
        mandateName: mandate?.name ?? null,
        triggeredBy: approval.triggeredBy,
        requestedAt: approval.requestedAt.toISOString(),
        decidedAt: approval.decidedAt?.toISOString() ?? null,
        comment: approval.comment
      };
    };

    return {
      organisation: { id: organisation.id, name: organisation.name, slug: organisation.slug },
      stats: {
        activeAgents: agents.filter((item) => item.status === "ACTIVE").length,
        activeMandates: this.state.mandates.filter(
          (item) => item.organisationId === organisationId && item.status === "ACTIVE"
        ).length,
        spendToday: minorUnitsToMoney(
          reserved
            .filter((item) => item.createdAt.getTime() >= dayStart)
            .reduce((sum, item) => sum + BigInt(item.amountMinor), 0n)
        ),
        approvalsWaiting: this.state.approvals.filter(
          (item) => item.organisationId === organisationId && item.status === "PENDING"
        ).length,
        allowedRequests: authorizations.filter(
          (item) => item.decision === "ALLOW" && item.createdAt.getTime() >= dayStart
        ).length,
        deniedRequests: authorizations.filter(
          (item) => item.decision === "DENY" && item.createdAt.getTime() >= dayStart
        ).length
      },
      agents: agents.map((agent) => {
        const mandate = this.state.mandates
          .filter((item) => item.agentId === agent.id && item.status === "ACTIVE")
          .sort((left, right) => right.version - left.version)[0];
        const credentials = this.state.credentials
          .filter((item) => item.agentId === agent.id)
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
          .slice(0, 10);
        const credential = credentials.find((item) => item.revokedAt === null);
        const agentReserved = reserved.filter((item) => item.agentId === agent.id);
        return {
          id: agent.id,
          name: agent.name,
          slug: agent.slug,
          description: agent.description,
          status: agent.status,
          keyPrefix: credential?.keyPrefix ?? null,
          credentials: credentials.map((item) => ({
            id: item.id,
            keyPrefix: item.keyPrefix,
            status: item.revokedAt ? "REVOKED" as const : "ACTIVE" as const,
            createdAt: item.createdAt.toISOString(),
            lastUsedAt: item.lastUsedAt?.toISOString() ?? null,
            revokedAt: item.revokedAt?.toISOString() ?? null,
            rotatedFromId: item.rotatedFromId
          })),
          mandate: mandate
            ? {
                id: mandate.id,
                name: mandate.name,
                version: mandate.version,
                validUntil: mandate.validUntil,
                capabilities: [...mandate.capabilities]
              }
            : null,
          spendToday: minorUnitsToMoney(
            agentReserved
              .filter((item) => item.createdAt.getTime() >= dayStart)
              .reduce((sum, item) => sum + BigInt(item.amountMinor), 0n)
          ),
          spendMonth: minorUnitsToMoney(
            agentReserved
              .filter((item) => item.createdAt.getTime() >= monthStart)
              .reduce((sum, item) => sum + BigInt(item.amountMinor), 0n)
          ),
          createdAt: agent.createdAt.toISOString()
        };
      }),
      authorizations: authorizations.map((auth) => ({
        id: auth.id,
        organisationId: auth.organisationId,
        agentId: auth.agentId,
        agentName: auth.agentName,
        mandateId: auth.mandateId,
        capability: auth.capability,
        amount: { value: minorUnitsToMoney(auth.amountMinor), currency: "USD" },
        vendor: { id: auth.vendorId, name: auth.vendorName },
        metadata: structuredClone(auth.metadata),
        decision: auth.decision,
        state: auth.state,
        reasonCodes: [...auth.reasonCodes],
        trace: structuredClone(auth.trace),
        approvalId: auth.approvalId,
        createdAt: auth.createdAt.toISOString(),
        expiresAt: auth.expiresAt?.toISOString() ?? null
      })),
      approvals: this.state.approvals
        .filter((item) => item.organisationId === organisationId)
        .map(toApprovalView)
        .filter((item): item is ApprovalView => item !== null)
        .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt)),
      auditEvents: await this.getAuditEvents(organisationId, 150)
    };
  }

  async getApprovalView(organisationId: string, approvalId: string): Promise<ApprovalView | null> {
    const snapshot = await this.getDashboardSnapshot(organisationId, new Date());
    return snapshot?.approvals.find((item) => item.id === approvalId) ?? null;
  }

  async getAuditEvents(organisationId: string, limit: number): Promise<AuditEventView[]> {
    return this.state.auditEvents
      .filter((item) => item.organisationId === organisationId)
      .sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime())
      .slice(0, Math.min(Math.max(limit, 1), 500))
      .map((item) => ({
        id: item.id,
        actorType: item.actorType,
        actorId: item.actorId,
        eventType: item.eventType,
        entityType: item.entityType,
        entityId: item.entityId,
        timestamp: item.timestamp.toISOString(),
        metadata: structuredClone(item.metadata)
      }));
  }

  async getBillingAccount(organisationId: string, now: Date): Promise<BillingAccountRecord | null> {
    if (!this.state.organisations.some((organisation) => organisation.id === organisationId)) return null;
    const allowance = await this.getBillingAllowance(organisationId, now);
    const inPeriod = (occurredAt: Date) =>
      occurredAt >= allowance.subscription.currentPeriodStart && occurredAt < allowance.subscription.currentPeriodEnd;
    const approvalRequests = this.state.billingUsageEvents
      .filter(
        (event) =>
          event.organisationId === organisationId && event.metric === "APPROVAL_REQUEST" && inPeriod(event.occurredAt)
      )
      .reduce((sum, event) => sum + Number(event.quantity), 0);
    const auditEvents = this.state.auditEvents.filter(
      (event) => event.organisationId === organisationId && inPeriod(event.timestamp)
    ).length;

    return {
      ...allowance,
      approvalRequests,
      auditEvents,
      integrationConnections: 0
    };
  }

  inspect(): MemoryState {
    return structuredClone(this.state);
  }
}

const VOLUME_STATE_FORMAT = "CAPYN_VOLUME_STATE";
const VOLUME_STATE_VERSION = 1;
const stateCollections = [
  "organisations",
  "users",
  "userCredentials",
  "agents",
  "credentials",
  "mandates",
  "authorizations",
  "approvals",
  "executions",
  "auditEvents",
  "subscriptions",
  "billingUsageEvents",
  "billingWebhookEvents",
  "productionLaunches"
] as const satisfies ReadonlyArray<keyof MemoryState>;

function readStateEnvelope(value: unknown): MemoryState {
  if (typeof value !== "object" || value === null) throw new Error("CAPYN volume state envelope is invalid");
  const envelope = value as { format?: unknown; version?: unknown; state?: unknown };
  if (envelope.format !== VOLUME_STATE_FORMAT || envelope.version !== VOLUME_STATE_VERSION) {
    throw new Error("CAPYN volume state format is unsupported");
  }
  if (typeof envelope.state !== "object" || envelope.state === null) {
    throw new Error("CAPYN volume state payload is invalid");
  }
  const state = envelope.state as Partial<Record<keyof MemoryState, unknown>>;
  if (stateCollections.some((key) => !Array.isArray(state[key]))) {
    throw new Error("CAPYN volume state is incomplete");
  }
  return structuredClone(state) as MemoryState;
}

export class VolumeCapynRepository extends InMemoryCapynRepository {
  constructor(
    private readonly statePath: string,
    initial: MemoryState
  ) {
    super(initial);
  }

  override async transaction<T>(work: (tx: CapynTransaction) => Promise<T>): Promise<T> {
    return super.transaction(async (tx) => {
      const result = await work(tx);
      await this.checkpoint();
      return result;
    });
  }

  async checkpoint(): Promise<void> {
    const folder = dirname(this.statePath);
    const temporaryPath = `${this.statePath}.${process.pid}.tmp`;
    await mkdir(folder, { recursive: true, mode: 0o700 });
    const payload = serialize({
      format: VOLUME_STATE_FORMAT,
      version: VOLUME_STATE_VERSION,
      state: this.inspect()
    });
    await writeFile(temporaryPath, payload, { mode: 0o600, flush: true });
    await rename(temporaryPath, this.statePath);
  }
}

export async function createVolumeCapynRepository(
  statePath: string,
  keyHash: string
): Promise<{ repository: VolumeCapynRepository; ids: DemoSeedIds }> {
  const seeded = createDemoMemoryRepository(keyHash);
  let initial = seeded.repository.inspect();
  let loaded = false;
  try {
    initial = readStateEnvelope(deserialize(await readFile(statePath)) as unknown);
    loaded = true;
  } catch (error) {
    if (!(typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }
  if (!loaded) {
    const now = new Date();
    for (const mandate of initial.mandates) {
      mandate.validFrom = new Date(now.getTime() - 24 * 60 * 60 * 1_000).toISOString();
      mandate.validUntil = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1_000).toISOString();
    }
    for (const subscription of initial.subscriptions) {
      subscription.currentPeriodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      subscription.currentPeriodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    }
  }
  const repository = new VolumeCapynRepository(statePath, initial);
  if (!loaded) await repository.checkpoint();
  return { repository, ids: seeded.ids };
}

export function createDemoMemoryRepository(keyHash: string): {
  repository: InMemoryCapynRepository;
  ids: DemoSeedIds;
} {
  const ids: DemoSeedIds = {
    organisationId: "org_demo_acme",
    ownerId: "usr_demo_owner",
    approverId: "usr_demo_approver",
    agentId: "agt_demo_procurement",
    credentialId: "key_demo_procurement",
    mandateId: "man_demo_procurement_v1",
    demoApiKey: "capyn_demo_N7m2kQ4xR8vB3pL6sT9wY1cF5hJ0dG2a"
  };
  const createdAt = new Date("2026-08-01T00:00:00.000Z");
  const state = blankState();
  state.organisations.push({ id: ids.organisationId, name: "Acme AI", slug: "acme-ai", createdAt });
  state.subscriptions.push({
    id: "sub_demo_acme",
    organisationId: ids.organisationId,
    planId: "DEVELOPER",
    status: "ACTIVE",
    provider: "INTERNAL",
    providerCustomerId: null,
    providerSubscriptionId: null,
    currentPeriodStart: new Date("2026-08-01T00:00:00.000Z"),
    currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z"),
    cancelAtPeriodEnd: false
  });
  state.users.push(
    {
      id: ids.ownerId,
      organisationId: ids.organisationId,
      name: "Acme Owner",
      email: "owner@acme.test",
      role: "OWNER"
    },
    {
      id: ids.approverId,
      organisationId: ids.organisationId,
      name: "Alex Approver",
      email: "approver@acme.test",
      role: "APPROVER"
    }
  );
  state.agents.push({
    id: ids.agentId,
    organisationId: ids.organisationId,
    name: "procurement-agent",
    slug: "procurement-agent",
    description: "Purchases approved compute and API capacity.",
    status: "ACTIVE",
    createdAt
  });
  state.credentials.push({
    id: ids.credentialId,
    agentId: ids.agentId,
    keyPrefix: "capyn_demo_N7m2",
    keyHash,
    createdAt,
    lastUsedAt: null,
    revokedAt: null,
    rotationIdempotencyKey: null,
    rotatedFromId: null
  });
  state.mandates.push({
    id: ids.mandateId,
    organisationId: ids.organisationId,
    agentId: ids.agentId,
    name: "Procurement authority",
    version: 1,
    status: "ACTIVE",
    validFrom: "2026-08-01T00:00:00.000Z",
    validUntil: "2026-09-30T00:00:00.000Z",
    createdBy: ids.ownerId,
    createdAt,
    revokedAt: null,
    capabilities: ["spend.compute", "spend.api", "aws.ec2.run-instances.dry-run"],
    policy: {
      currency: "USD",
      allowedVendorIds: ["openai", "anthropic", "aws"],
      perTransactionLimitMinor: "15000",
      dailyLimitMinor: "20000",
      monthlyLimitMinor: "200000",
      approvalThresholdMinor: "10000"
    }
  });
  return { repository: new InMemoryCapynRepository(state), ids };
}
