import {
  Prisma,
  PrismaClient,
  type Agent as PrismaAgent,
  type AgentCredential,
  type ApprovalRequest,
  type Execution,
  type OrganisationSubscription,
  type User
} from "@prisma/client";
import {
  REASON_CODES,
  jsonValueSchema,
  minorUnitsToMoney,
  ruleTraceSchema,
  vendorSchema,
  type AgentStatus,
  type ApprovalView,
  type AuditEventView,
  type AuthorizationState,
  type DashboardSnapshot,
  type JsonValue,
  type ReasonCode,
  type RuleTrace
} from "@capyn/types";
import { z } from "zod";
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
  CredentialAuthRecord,
  BillingAccountRecord,
  BillingAllowance,
  RecordBillingUsage,
  RecordBillingWebhook,
  StoredApproval,
  StoredAuthorization,
  StoredExecution,
  StoredSubscription,
  UpdateSubscriptionRecord,
  UserAuthRecord
} from "./contracts";

const reasonCodesSchema = z.array(z.enum(REASON_CODES));
const traceSchema = z.array(ruleTraceSchema);
const metadataSchema = z.record(jsonValueSchema);
const allowedVendorsSchema = z.array(vendorSchema);

type AuthorizationRow = Prisma.AuthorizationGetPayload<{
  include: { agent: { select: { name: true } }; approval: { select: { id: true } } };
}>;

function jsonInput(value: JsonValue | Record<string, JsonValue> | RuleTrace[] | ReasonCode[]): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function mapAgent(row: PrismaAgent): AgentRecord {
  return {
    id: row.id,
    organisationId: row.organisationId,
    name: row.name,
    slug: row.slug,
    description: row.description,
    status: row.status,
    createdAt: row.createdAt
  };
}

function mapCredential(row: AgentCredential & { agent: PrismaAgent }): CredentialAuthRecord {
  return {
    id: row.id,
    keyHash: row.keyHash,
    organisationId: row.agent.organisationId,
    agentId: row.agentId,
    revokedAt: row.revokedAt
  };
}

function mapUser(row: User): UserAuthRecord {
  return {
    id: row.id,
    organisationId: row.organisationId,
    name: row.name,
    email: row.email,
    role: row.role
  };
}

function mapAuthorization(row: AuthorizationRow): StoredAuthorization {
  if (row.currency !== "USD") throw new Error("Unsupported authorization currency in database");
  return {
    id: row.id,
    organisationId: row.organisationId,
    agentId: row.agentId,
    agentName: row.agent.name,
    mandateId: row.mandateId,
    idempotencyKey: row.idempotencyKey,
    requestHash: row.requestHash,
    capability: row.capability,
    amountMinor: row.amountMinor.toString(),
    currency: "USD",
    vendorId: row.vendorId,
    vendorName: row.vendorName,
    metadata: metadataSchema.parse(row.metadata),
    decision: row.decision,
    state: row.state,
    reasonCodes: reasonCodesSchema.parse(row.reasonCodes),
    trace: traceSchema.parse(row.evaluationTrace),
    approvalId: row.approval?.id ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    expiresAt: row.expiresAt
  };
}

function mapApproval(row: ApprovalRequest): StoredApproval {
  const reason = z.enum(REASON_CODES).parse(row.triggeredBy);
  return {
    id: row.id,
    organisationId: row.organisationId,
    authorizationId: row.authorizationId,
    status: row.status,
    triggeredBy: reason,
    requestedAt: row.requestedAt,
    decidedAt: row.decidedAt,
    decidedBy: row.decidedBy,
    comment: row.comment
  };
}

function mapExecution(row: Execution): StoredExecution {
  return {
    id: row.id,
    organisationId: row.organisationId,
    authorizationId: row.authorizationId,
    status: row.status,
    provider: row.provider,
    externalReference: row.externalReference,
    errorCode: row.errorCode,
    createdAt: row.createdAt,
    completedAt: row.completedAt
  };
}

function mapSubscription(row: OrganisationSubscription): StoredSubscription {
  return {
    id: row.id,
    organisationId: row.organisationId,
    planId: row.plan,
    status: row.status,
    provider: row.provider,
    providerCustomerId: row.providerCustomerId,
    providerSubscriptionId: row.providerSubscriptionId,
    currentPeriodStart: row.currentPeriodStart,
    currentPeriodEnd: row.currentPeriodEnd,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd
  };
}

function purposeFromMetadata(value: Prisma.JsonValue): string | null {
  const metadata = metadataSchema.parse(value);
  return typeof metadata.purpose === "string" ? metadata.purpose : null;
}

function spendReservationWhere(agentId: string, currency: "USD", from: Date, now: Date): Prisma.AuthorizationWhereInput {
  return {
    agentId,
    currency,
    createdAt: { gte: from },
    OR: [
      { state: { in: ["EXECUTING", "EXECUTED"] } },
      { state: { in: ["ALLOWED", "APPROVED"] }, expiresAt: { gt: now } }
    ]
  };
}

function organisationSpendWhere(
  organisationId: string,
  currency: "USD",
  from: Date,
  now: Date
): Prisma.AuthorizationWhereInput {
  return {
    organisationId,
    currency,
    createdAt: { gte: from },
    OR: [
      { state: { in: ["EXECUTING", "EXECUTED"] } },
      { state: { in: ["ALLOWED", "APPROVED"] }, expiresAt: { gt: now } }
    ]
  };
}

function utcDayStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function utcMonthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

class PrismaCapynTransaction implements CapynTransaction {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async lockAgent(agentId: string): Promise<void> {
    await this.db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${agentId}, 0))`;
  }

  async lockOrganisation(organisationId: string): Promise<void> {
    await this.db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`billing:${organisationId}`}, 0))`;
  }

  async findAgent(agentId: string): Promise<AgentRecord | null> {
    const row = await this.db.agent.findUnique({ where: { id: agentId } });
    return row ? mapAgent(row) : null;
  }

  async findIdempotentAuthorization(agentId: string, idempotencyKey: string): Promise<StoredAuthorization | null> {
    const row = await this.db.authorization.findUnique({
      where: { agentId_idempotencyKey: { agentId, idempotencyKey } },
      include: { agent: { select: { name: true } }, approval: { select: { id: true } } }
    });
    return row ? mapAuthorization(row) : null;
  }

  async loadPolicyContext(agentId: string, currency: "USD", now: Date) {
    const agent = await this.db.agent.findUnique({
      where: { id: agentId },
      include: {
        mandates: {
          where: { status: "ACTIVE" },
          orderBy: [{ version: "desc" }, { createdAt: "desc" }],
          include: { capabilities: true, spendingPolicy: true }
        }
      }
    });
    if (!agent) throw new Error("Agent not found");

    const [daily, monthly] = await Promise.all([
      this.db.authorization.aggregate({
        where: spendReservationWhere(agentId, currency, utcDayStart(now), now),
        _sum: { amountMinor: true }
      }),
      this.db.authorization.aggregate({
        where: spendReservationWhere(agentId, currency, utcMonthStart(now), now),
        _sum: { amountMinor: true }
      })
    ]);

    const mandate = agent.mandates[0];
    let policy = null;
    if (mandate?.spendingPolicy && mandate.spendingPolicy.currency === "USD") {
      const vendors = allowedVendorsSchema.safeParse(mandate.spendingPolicy.allowedVendors);
      policy = {
        currency: "USD" as const,
        allowedVendorIds: vendors.success ? vendors.data.map((vendor) => vendor.id) : [],
        perTransactionLimitMinor: mandate.spendingPolicy.perTransactionLimitMinor.toString(),
        dailyLimitMinor: mandate.spendingPolicy.dailyLimitMinor.toString(),
        monthlyLimitMinor: mandate.spendingPolicy.monthlyLimitMinor.toString(),
        approvalThresholdMinor: mandate.spendingPolicy.approvalThresholdMinor.toString()
      };
    }

    return {
      now: now.toISOString(),
      agent: { id: agent.id, status: agent.status },
      activeMandateCount: agent.mandates.length,
      mandate: mandate
        ? {
            id: mandate.id,
            name: mandate.name,
            version: mandate.version,
            status: mandate.status,
            validFrom: mandate.validFrom.toISOString(),
            validUntil: mandate.validUntil.toISOString(),
            capabilities: mandate.capabilities.map((item) => item.capability),
            policy
          }
        : null,
      spend: {
        dailyMinor: (daily._sum.amountMinor ?? 0n).toString(),
        monthlyMinor: (monthly._sum.amountMinor ?? 0n).toString()
      }
    };
  }

  async createAuthorization(input: CreateAuthorizationRecord): Promise<StoredAuthorization> {
    const row = await this.db.authorization.create({
      data: {
        id: input.id,
        organisationId: input.organisationId,
        agentId: input.agentId,
        mandateId: input.mandateId,
        idempotencyKey: input.idempotencyKey,
        requestHash: input.requestHash,
        capability: input.capability,
        amountMinor: BigInt(input.amountMinor),
        currency: input.currency,
        vendorId: input.vendorId,
        vendorName: input.vendorName,
        metadata: jsonInput(input.metadata),
        decision: input.decision,
        state: input.state,
        reasonCodes: jsonInput(input.reasonCodes),
        evaluationTrace: jsonInput(input.trace),
        expiresAt: input.expiresAt
      },
      include: { agent: { select: { name: true } }, approval: { select: { id: true } } }
    });
    return mapAuthorization(row);
  }

  async findAuthorization(id: string): Promise<StoredAuthorization | null> {
    const row = await this.db.authorization.findUnique({
      where: { id },
      include: { agent: { select: { name: true } }, approval: { select: { id: true } } }
    });
    return row ? mapAuthorization(row) : null;
  }

  async updateAuthorization(
    id: string,
    update: { state: AuthorizationState; expiresAt?: Date | null }
  ): Promise<StoredAuthorization> {
    const data: Prisma.AuthorizationUpdateInput = { state: update.state };
    if ("expiresAt" in update) data.expiresAt = update.expiresAt;
    const row = await this.db.authorization.update({
      where: { id },
      data,
      include: { agent: { select: { name: true } }, approval: { select: { id: true } } }
    });
    return mapAuthorization(row);
  }

  async createApproval(input: CreateApprovalRecord): Promise<StoredApproval> {
    return mapApproval(
      await this.db.approvalRequest.create({
        data: {
          id: input.id,
          organisationId: input.organisationId,
          authorizationId: input.authorizationId,
          triggeredBy: input.triggeredBy
        }
      })
    );
  }

  async findApproval(id: string): Promise<StoredApproval | null> {
    const row = await this.db.approvalRequest.findUnique({ where: { id } });
    return row ? mapApproval(row) : null;
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
    return mapApproval(await this.db.approvalRequest.update({ where: { id }, data: update }));
  }

  async findExecutionByAuthorization(authorizationId: string): Promise<StoredExecution | null> {
    const row = await this.db.execution.findUnique({ where: { authorizationId } });
    return row ? mapExecution(row) : null;
  }

  async createExecution(input: CreateExecutionRecord): Promise<StoredExecution> {
    return mapExecution(
      await this.db.execution.create({
        data: {
          id: input.id,
          organisationId: input.organisationId,
          authorizationId: input.authorizationId,
          provider: input.provider
        }
      })
    );
  }

  async updateExecution(
    id: string,
    update: {
      status: "EXECUTED" | "FAILED";
      externalReference: string | null;
      errorCode: string | null;
      completedAt: Date;
    }
  ): Promise<StoredExecution> {
    return mapExecution(await this.db.execution.update({ where: { id }, data: update }));
  }

  async appendAudit(input: AppendAuditEvent): Promise<void> {
    await this.db.auditEvent.create({
      data: {
        id: input.id,
        organisationId: input.organisationId,
        actorType: input.actorType,
        actorId: input.actorId,
        eventType: input.eventType,
        entityType: input.entityType,
        entityId: input.entityId,
        timestamp: input.timestamp,
        metadata: jsonInput(input.metadata)
      }
    });
  }

  async createAgent(input: CreateAgentRecord): Promise<AgentRecord> {
    return mapAgent(await this.db.agent.create({ data: input }));
  }

  async updateAgentStatus(agentId: string, status: AgentStatus): Promise<AgentRecord> {
    return mapAgent(await this.db.agent.update({ where: { id: agentId }, data: { status } }));
  }

  async createCredential(input: CreateCredentialRecord): Promise<void> {
    await this.db.agentCredential.create({ data: input });
  }

  async revokeCredential(credentialId: string, agentId: string, at: Date): Promise<boolean> {
    const result = await this.db.agentCredential.updateMany({
      where: { id: credentialId, agentId, revokedAt: null },
      data: { revokedAt: at }
    });
    return result.count === 1;
  }

  async revokeAgentCredentials(agentId: string, at: Date): Promise<number> {
    const result = await this.db.agentCredential.updateMany({
      where: { agentId, revokedAt: null },
      data: { revokedAt: at }
    });
    return result.count;
  }

  async createActiveMandate(input: CreateMandateRecord): Promise<{ id: string; version: number }> {
    const current = await this.db.mandate.aggregate({ where: { agentId: input.agentId }, _max: { version: true } });
    const version = (current._max.version ?? 0) + 1;
    await this.db.mandate.updateMany({
      where: { agentId: input.agentId, status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: input.validFrom }
    });
    await this.db.mandate.create({
      data: {
        id: input.id,
        organisationId: input.organisationId,
        agentId: input.agentId,
        name: input.name,
        version,
        status: "ACTIVE",
        validFrom: input.validFrom,
        validUntil: input.validUntil,
        createdBy: input.createdBy,
        capabilities: { createMany: { data: input.capabilities.map((capability) => ({ capability })) } },
        spendingPolicy: {
          create: {
            id: input.policyId,
            currency: input.currency,
            allowedVendors: jsonInput(input.allowedVendors),
            perTransactionLimitMinor: BigInt(input.perTransactionLimitMinor),
            dailyLimitMinor: BigInt(input.dailyLimitMinor),
            monthlyLimitMinor: BigInt(input.monthlyLimitMinor),
            approvalThresholdMinor: BigInt(input.approvalThresholdMinor)
          }
        }
      }
    });
    return { id: input.id, version };
  }

  async revokeActiveMandates(agentId: string, at: Date): Promise<number> {
    const result = await this.db.mandate.updateMany({
      where: { agentId, status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: at }
    });
    return result.count;
  }

  async createOrganisation(input: CreateOrganisationRecord): Promise<{ organisationId: string; ownerId: string }> {
    await this.db.organisation.create({
      data: {
        ...input.organisation,
        users: { create: { ...input.owner, role: "OWNER" } },
        subscription: {
          create: {
            id: input.subscription.id,
            plan: "DEVELOPER",
            status: "ACTIVE",
            provider: "INTERNAL",
            currentPeriodStart: input.subscription.currentPeriodStart,
            currentPeriodEnd: input.subscription.currentPeriodEnd
          }
        }
      }
    });
    return { organisationId: input.organisation.id, ownerId: input.owner.id };
  }

  async getBillingAllowance(organisationId: string, now: Date): Promise<BillingAllowance> {
    let subscription = await this.db.organisationSubscription.findUnique({ where: { organisationId } });
    if (!subscription) throw new Error("Organisation subscription not found");
    if (
      subscription.plan === "DEVELOPER" &&
      (now < subscription.currentPeriodStart || now >= subscription.currentPeriodEnd)
    ) {
      subscription = await this.db.organisationSubscription.update({
        where: { organisationId },
        data: {
          currentPeriodStart: utcMonthStart(now),
          currentPeriodEnd: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
        }
      });
    }
    const [activeAgents, decisionUsage] = await Promise.all([
      this.db.agent.count({ where: { organisationId, status: "ACTIVE" } }),
      this.db.billingUsageEvent.aggregate({
        where: {
          organisationId,
          metric: "AUTHORIZATION_DECISION",
          occurredAt: { gte: subscription.currentPeriodStart, lt: subscription.currentPeriodEnd }
        },
        _sum: { quantity: true }
      })
    ]);
    return {
      subscription: mapSubscription(subscription),
      activeAgents,
      authorizationDecisions: Number(decisionUsage._sum.quantity ?? 0n)
    };
  }

  async recordBillingUsage(input: RecordBillingUsage): Promise<void> {
    await this.db.billingUsageEvent.upsert({
      where: {
        organisationId_metric_sourceType_sourceId: {
          organisationId: input.organisationId,
          metric: input.metric,
          sourceType: input.sourceType,
          sourceId: input.sourceId
        }
      },
      create: {
        id: input.id,
        organisationId: input.organisationId,
        metric: input.metric,
        quantity: BigInt(input.quantity),
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        occurredAt: input.occurredAt,
        metadata: jsonInput(input.metadata)
      },
      update: {}
    });
  }

  async updateSubscription(input: UpdateSubscriptionRecord): Promise<StoredSubscription> {
    return mapSubscription(
      await this.db.organisationSubscription.update({
        where: { organisationId: input.organisationId },
        data: {
          plan: input.planId,
          status: input.status,
          provider: input.provider,
          providerCustomerId: input.providerCustomerId,
          providerSubscriptionId: input.providerSubscriptionId,
          currentPeriodStart: input.currentPeriodStart,
          currentPeriodEnd: input.currentPeriodEnd,
          cancelAtPeriodEnd: input.cancelAtPeriodEnd
        }
      })
    );
  }

  async recordBillingWebhook(input: RecordBillingWebhook): Promise<boolean> {
    const result = await this.db.billingWebhookEvent.createMany({
      data: {
        id: input.id,
        provider: input.provider,
        providerEventId: input.providerEventId,
        eventType: input.eventType,
        payloadHash: input.payloadHash,
        receivedAt: input.receivedAt,
        processedAt: input.processedAt
      },
      skipDuplicates: true
    });
    return result.count === 1;
  }
}

export class PrismaCapynRepository implements CapynRepository {
  constructor(readonly client: PrismaClient = new PrismaClient()) {}

  async findCredentialByHash(keyHash: string): Promise<CredentialAuthRecord | null> {
    const row = await this.client.agentCredential.findUnique({ where: { keyHash }, include: { agent: true } });
    return row ? mapCredential(row) : null;
  }

  async touchCredential(id: string, at: Date): Promise<void> {
    await this.client.agentCredential.updateMany({ where: { id, revokedAt: null }, data: { lastUsedAt: at } });
  }

  async findUser(id: string): Promise<UserAuthRecord | null> {
    const row = await this.client.user.findUnique({ where: { id } });
    return row ? mapUser(row) : null;
  }

  async transaction<T>(work: (tx: CapynTransaction) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.client.$transaction(
          async (db) => work(new PrismaCapynTransaction(db)),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );
      } catch (error) {
        const retryable = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
        if (!retryable || attempt === 2) throw error;
      }
    }
    throw new Error("Transaction retry exhausted");
  }

  async getDashboardSnapshot(organisationId: string, now: Date): Promise<DashboardSnapshot | null> {
    const organisation = await this.client.organisation.findUnique({ where: { id: organisationId } });
    if (!organisation) return null;
    const dayStart = utcDayStart(now);
    const monthStart = utcMonthStart(now);

    const [agents, authorizations, approvalRows, auditRows, activeMandates, waiting, allowed, denied, spend] =
      await Promise.all([
        this.client.agent.findMany({
          where: { organisationId },
          orderBy: { createdAt: "asc" },
          include: {
            credentials: { where: { revokedAt: null }, orderBy: { createdAt: "desc" }, take: 1 },
            mandates: {
              where: { status: "ACTIVE" },
              orderBy: { version: "desc" },
              take: 1,
              include: { capabilities: true }
            }
          }
        }),
        this.client.authorization.findMany({
          where: { organisationId },
          orderBy: { createdAt: "desc" },
          take: 100,
          include: { agent: { select: { name: true } }, approval: { select: { id: true } } }
        }),
        this.client.approvalRequest.findMany({
          where: { organisationId },
          orderBy: { requestedAt: "desc" },
          take: 100,
          include: { authorization: { include: { agent: true, mandate: true } } }
        }),
        this.client.auditEvent.findMany({ where: { organisationId }, orderBy: { timestamp: "desc" }, take: 150 }),
        this.client.mandate.count({ where: { organisationId, status: "ACTIVE" } }),
        this.client.approvalRequest.count({ where: { organisationId, status: "PENDING" } }),
        this.client.authorization.count({ where: { organisationId, decision: "ALLOW", createdAt: { gte: dayStart } } }),
        this.client.authorization.count({ where: { organisationId, decision: "DENY", createdAt: { gte: dayStart } } }),
        this.client.authorization.aggregate({
          where: organisationSpendWhere(organisationId, "USD", dayStart, now),
          _sum: { amountMinor: true }
        })
      ]);

    const agentSpend = await Promise.all(
      agents.map(async (agent) => {
        const [daily, monthly] = await Promise.all([
          this.client.authorization.aggregate({
            where: spendReservationWhere(agent.id, "USD", dayStart, now),
            _sum: { amountMinor: true }
          }),
          this.client.authorization.aggregate({
            where: spendReservationWhere(agent.id, "USD", monthStart, now),
            _sum: { amountMinor: true }
          })
        ]);
        return { daily: daily._sum.amountMinor ?? 0n, monthly: monthly._sum.amountMinor ?? 0n };
      })
    );

    return {
      organisation: { id: organisation.id, name: organisation.name, slug: organisation.slug },
      stats: {
        activeAgents: agents.filter((agent) => agent.status === "ACTIVE").length,
        activeMandates,
        spendToday: minorUnitsToMoney(spend._sum?.amountMinor ?? 0n),
        approvalsWaiting: waiting,
        allowedRequests: allowed,
        deniedRequests: denied
      },
      agents: agents.map((agent, index) => {
        const mandate = agent.mandates[0];
        const totals = agentSpend[index] ?? { daily: 0n, monthly: 0n };
        return {
          id: agent.id,
          name: agent.name,
          slug: agent.slug,
          description: agent.description,
          status: agent.status,
          keyPrefix: agent.credentials[0]?.keyPrefix ?? null,
          mandate: mandate
            ? {
                id: mandate.id,
                name: mandate.name,
                version: mandate.version,
                validUntil: mandate.validUntil.toISOString(),
                capabilities: mandate.capabilities.map((item) => item.capability)
              }
            : null,
          spendToday: minorUnitsToMoney(totals.daily),
          spendMonth: minorUnitsToMoney(totals.monthly),
          createdAt: agent.createdAt.toISOString()
        };
      }),
      authorizations: authorizations.map((row) => {
        const auth = mapAuthorization(row);
        return {
          id: auth.id,
          organisationId: auth.organisationId,
          agentId: auth.agentId,
          agentName: auth.agentName,
          mandateId: auth.mandateId,
          capability: auth.capability,
          amount: { value: minorUnitsToMoney(auth.amountMinor), currency: "USD" as const },
          vendor: { id: auth.vendorId, name: auth.vendorName },
          metadata: auth.metadata,
          decision: auth.decision,
          state: auth.state,
          reasonCodes: auth.reasonCodes,
          trace: auth.trace,
          approvalId: auth.approvalId,
          createdAt: auth.createdAt.toISOString(),
          expiresAt: auth.expiresAt?.toISOString() ?? null
        };
      }),
      approvals: approvalRows.map((row) => ({
        id: row.id,
        authorizationId: row.authorizationId,
        status: row.status,
        agentId: row.authorization.agentId,
        agentName: row.authorization.agent.name,
        capability: row.authorization.capability,
        vendor: { id: row.authorization.vendorId, name: row.authorization.vendorName },
        amount: { value: minorUnitsToMoney(row.authorization.amountMinor), currency: "USD" as const },
        purpose: purposeFromMetadata(row.authorization.metadata),
        mandateName: row.authorization.mandate?.name ?? null,
        triggeredBy: z.enum(REASON_CODES).parse(row.triggeredBy),
        requestedAt: row.requestedAt.toISOString(),
        decidedAt: row.decidedAt?.toISOString() ?? null,
        comment: row.comment
      })),
      auditEvents: auditRows.map((row) => ({
        id: row.id,
        actorType: row.actorType,
        actorId: row.actorId,
        eventType: row.eventType,
        entityType: row.entityType,
        entityId: row.entityId,
        timestamp: row.timestamp.toISOString(),
        metadata: metadataSchema.parse(row.metadata)
      }))
    };
  }

  async getApprovalView(organisationId: string, approvalId: string): Promise<ApprovalView | null> {
    const row = await this.client.approvalRequest.findFirst({
      where: { id: approvalId, organisationId },
      include: { authorization: { include: { agent: true, mandate: true } } }
    });
    if (!row) return null;
    const metadata = metadataSchema.parse(row.authorization.metadata);
    return {
      id: row.id,
      authorizationId: row.authorizationId,
      status: row.status,
      agentId: row.authorization.agentId,
      agentName: row.authorization.agent.name,
      capability: row.authorization.capability,
      vendor: { id: row.authorization.vendorId, name: row.authorization.vendorName },
      amount: { value: minorUnitsToMoney(row.authorization.amountMinor), currency: "USD" },
      purpose: typeof metadata.purpose === "string" ? metadata.purpose : null,
      mandateName: row.authorization.mandate?.name ?? null,
      triggeredBy: z.enum(REASON_CODES).parse(row.triggeredBy),
      requestedAt: row.requestedAt.toISOString(),
      decidedAt: row.decidedAt?.toISOString() ?? null,
      comment: row.comment
    };
  }

  async getAuditEvents(organisationId: string, limit: number): Promise<AuditEventView[]> {
    const rows = await this.client.auditEvent.findMany({
      where: { organisationId },
      orderBy: { timestamp: "desc" },
      take: Math.min(Math.max(limit, 1), 500)
    });
    return rows.map((row) => ({
      id: row.id,
      actorType: row.actorType,
      actorId: row.actorId,
      eventType: row.eventType,
      entityType: row.entityType,
      entityId: row.entityId,
      timestamp: row.timestamp.toISOString(),
      metadata: metadataSchema.parse(row.metadata)
    }));
  }

  async getBillingAccount(organisationId: string, now: Date): Promise<BillingAccountRecord | null> {
    let subscription = await this.client.organisationSubscription.findUnique({ where: { organisationId } });
    if (!subscription) return null;
    if (
      subscription.plan === "DEVELOPER" &&
      (now < subscription.currentPeriodStart || now >= subscription.currentPeriodEnd)
    ) {
      subscription = await this.client.organisationSubscription.update({
        where: { organisationId },
        data: {
          currentPeriodStart: utcMonthStart(now),
          currentPeriodEnd: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
        }
      });
    }
    const periodStart = subscription.currentPeriodStart;
    const periodEnd = subscription.currentPeriodEnd;
    const [activeAgents, decisionUsage, approvalUsage, auditEvents] = await Promise.all([
      this.client.agent.count({ where: { organisationId, status: "ACTIVE" } }),
      this.client.billingUsageEvent.aggregate({
        where: {
          organisationId,
          metric: "AUTHORIZATION_DECISION",
          occurredAt: { gte: periodStart, lt: periodEnd }
        },
        _sum: { quantity: true }
      }),
      this.client.billingUsageEvent.aggregate({
        where: {
          organisationId,
          metric: "APPROVAL_REQUEST",
          occurredAt: { gte: periodStart, lt: periodEnd }
        },
        _sum: { quantity: true }
      }),
      this.client.auditEvent.count({
        where: { organisationId, timestamp: { gte: periodStart, lt: periodEnd } }
      })
    ]);
    return {
      subscription: mapSubscription(subscription),
      activeAgents,
      authorizationDecisions: Number(decisionUsage._sum.quantity ?? 0n),
      approvalRequests: Number(approvalUsage._sum.quantity ?? 0n),
      auditEvents,
      integrationConnections: 0
    };
  }
}
