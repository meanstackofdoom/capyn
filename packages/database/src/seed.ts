import { PrismaClient } from "@prisma/client";
import { hashApiKey } from "./credentials";

const db = new PrismaClient();
const demoApiKey = "capyn_demo_N7m2kQ4xR8vB3pL6sT9wY1cF5hJ0dG2a";
const pepper = process.env.API_KEY_PEPPER ?? "capyn-development-pepper-change-before-production";

async function seed(): Promise<void> {
  const organisationId = "org_demo_acme";
  const ownerId = "usr_demo_owner";
  const approverId = "usr_demo_approver";
  const agentId = "agt_demo_procurement";
  const mandateId = "man_demo_procurement_v1";
  const keyHash = hashApiKey(demoApiKey, pepper);
  const now = new Date();
  const mandateValidFrom = new Date(now.getTime() - 24 * 60 * 60 * 1_000);
  const mandateValidUntil = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1_000);
  const currentPeriodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const currentPeriodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  await db.$transaction(async (tx) => {
    await tx.organisation.upsert({
      where: { id: organisationId },
      update: { name: "Acme AI", slug: "acme-ai" },
      create: { id: organisationId, name: "Acme AI", slug: "acme-ai" }
    });
    await tx.organisationSubscription.upsert({
      where: { organisationId },
      update: { currentPeriodStart, currentPeriodEnd },
      create: {
        id: "sub_demo_acme",
        organisationId,
        plan: "DEVELOPER",
        status: "ACTIVE",
        provider: "INTERNAL",
        currentPeriodStart,
        currentPeriodEnd
      }
    });
    await tx.user.upsert({
      where: { id: ownerId },
      update: { name: "Acme Owner", email: "owner@acme.test", role: "OWNER" },
      create: {
        id: ownerId,
        organisationId,
        name: "Acme Owner",
        email: "owner@acme.test",
        role: "OWNER"
      }
    });
    await tx.user.upsert({
      where: { id: approverId },
      update: { name: "Alex Approver", email: "approver@acme.test", role: "APPROVER" },
      create: {
        id: approverId,
        organisationId,
        name: "Alex Approver",
        email: "approver@acme.test",
        role: "APPROVER"
      }
    });
    await tx.agent.upsert({
      where: { id: agentId },
      update: {
        name: "procurement-agent",
        slug: "procurement-agent",
        description: "Purchases approved compute and API capacity.",
        status: "ACTIVE"
      },
      create: {
        id: agentId,
        organisationId,
        name: "procurement-agent",
        slug: "procurement-agent",
        description: "Purchases approved compute and API capacity.",
        status: "ACTIVE"
      }
    });
    await tx.agentCredential.upsert({
      where: { keyHash },
      update: { revokedAt: null },
      create: {
        id: "key_demo_procurement",
        agentId,
        keyPrefix: "capyn_demo_N7m2",
        keyHash
      }
    });
    await tx.mandate.upsert({
      where: { id: mandateId },
      update: {
        name: "Procurement authority",
        status: "ACTIVE",
        validFrom: mandateValidFrom,
        validUntil: mandateValidUntil,
        revokedAt: null
      },
      create: {
        id: mandateId,
        organisationId,
        agentId,
        name: "Procurement authority",
        version: 1,
        status: "ACTIVE",
        validFrom: mandateValidFrom,
        validUntil: mandateValidUntil,
        createdBy: ownerId
      }
    });
    await tx.mandateCapability.createMany({
      data: [
        { mandateId, capability: "spend.compute" },
        { mandateId, capability: "aws.ec2.run-instances.dry-run" },
        { mandateId, capability: "spend.api" }
      ],
      skipDuplicates: true
    });
    await tx.spendingPolicy.upsert({
      where: { mandateId },
      update: {
        currency: "USD",
        allowedVendors: [
          { id: "openai", name: "OpenAI" },
          { id: "anthropic", name: "Anthropic" },
          { id: "aws", name: "AWS" }
        ],
        perTransactionLimitMinor: 15000n,
        dailyLimitMinor: 20000n,
        monthlyLimitMinor: 200000n,
        approvalThresholdMinor: 10000n
      },
      create: {
        id: "pol_demo_procurement_v1",
        mandateId,
        currency: "USD",
        allowedVendors: [
          { id: "openai", name: "OpenAI" },
          { id: "anthropic", name: "Anthropic" },
          { id: "aws", name: "AWS" }
        ],
        perTransactionLimitMinor: 15000n,
        dailyLimitMinor: 20000n,
        monthlyLimitMinor: 200000n,
        approvalThresholdMinor: 10000n
      }
    });
    await tx.auditEvent.createMany({
      data: [
        {
          id: "evt_demo_agent_created",
          organisationId,
          actorType: "USER",
          actorId: ownerId,
          eventType: "AGENT_CREATED",
          entityType: "Agent",
          entityId: agentId,
          metadata: { name: "procurement-agent" }
        },
        {
          id: "evt_demo_mandate_activated",
          organisationId,
          actorType: "USER",
          actorId: ownerId,
          eventType: "MANDATE_ACTIVATED",
          entityType: "Mandate",
          entityId: mandateId,
          metadata: { version: 1 }
        },
        {
          id: "evt_demo_key_created",
          organisationId,
          actorType: "USER",
          actorId: ownerId,
          eventType: "API_KEY_CREATED",
          entityType: "AgentCredential",
          entityId: "key_demo_procurement",
          metadata: { keyPrefix: "capyn_demo_N7m2" }
        }
      ],
      skipDuplicates: true
    });
  });

  process.stdout.write("CAPYN demo data is ready.\n");
  if (process.env.NODE_ENV !== "production") {
    process.stdout.write(`Agent API key: ${demoApiKey}\nDemo user: ${ownerId}\n`);
  }
}

seed()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Seed failed"}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
