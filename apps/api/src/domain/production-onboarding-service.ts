import {
  deriveOnboardingAgentApiKey,
  deriveOwnerAccessKey,
  hashApiKey,
  type CapynRepository,
  type CapynTransaction,
  type ProductionLaunchRecord
} from "@capyn/database";
import {
  moneyToMinorUnits,
  type ProductionLaunchRequest,
  type ProductionLaunchResult,
  type UserPrincipal
} from "@capyn/types";
import {
  BillingUnavailableError,
  ConflictError,
  InvalidRequestError
} from "../http/errors";
import { createId } from "./ids";
import { requestFingerprint } from "./canonical-json";
import type { BillingService } from "./billing-service";
import type { SandboxCredentialClaim, SandboxService } from "./sandbox-service";

const LAUNCH_IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/;
const MANDATE_LIFETIME_MS = 30 * 24 * 60 * 60 * 1_000;

interface ProvisionedLaunch {
  record: ProductionLaunchRecord;
  replayed: boolean;
}

export class ProductionOnboardingService {
  constructor(
    private readonly repository: CapynRepository,
    private readonly apiKeyPepper: string,
    private readonly sandbox: SandboxService,
    private readonly billing: BillingService,
    private readonly clock: () => Date = () => new Date(),
    private readonly persistence: "POSTGRESQL" | "VOLUME_JOURNAL" | "PROCESS_MEMORY" = "PROCESS_MEMORY"
  ) {}

  async launch(
    sandboxApiKey: string | undefined,
    idempotencyKey: string | undefined,
    input: ProductionLaunchRequest
  ): Promise<ProductionLaunchResult> {
    if (!idempotencyKey || !LAUNCH_IDEMPOTENCY_KEY.test(idempotencyKey)) {
      throw new InvalidRequestError(
        "INVALID_IDEMPOTENCY_KEY",
        "Idempotency-Key must contain 8-200 URL-safe characters"
      );
    }

    const claim = this.sandbox.inspect(sandboxApiKey);
    const sandboxCredentialHash = hashApiKey(sandboxApiKey!, this.apiKeyPepper);
    const requestHash = requestFingerprint({ sandboxCredentialHash, input });
    const ids = {
      launchId: createId("lch"),
      organisationId: createId("org"),
      ownerId: createId("usr"),
      ownerCredentialId: createId("ukey"),
      agentId: createId("agt"),
      agentCredentialId: createId("key"),
      mandateId: createId("man"),
      policyId: createId("pol"),
      subscriptionId: createId("sub")
    };
    const ownerCredential = deriveOwnerAccessKey(ids.ownerCredentialId, this.apiKeyPepper);
    const agentCredential = deriveOnboardingAgentApiKey(ids.agentCredentialId, this.apiKeyPepper);
    const now = this.clock();
    const mandateValidUntil = new Date(now.getTime() + MANDATE_LIFETIME_MS);

    let provisioned: ProvisionedLaunch;
    try {
      provisioned = await this.repository.transaction(async (tx) => {
        const existingBySandbox = await tx.findProductionLaunchBySandboxHash(sandboxCredentialHash);
        if (existingBySandbox) {
          if (existingBySandbox.idempotencyKey === idempotencyKey) {
            this.assertReplay(existingBySandbox, sandboxCredentialHash, requestHash);
            return { record: existingBySandbox, replayed: true };
          }
          throw new ConflictError(
            "SANDBOX_ALREADY_LAUNCHED",
            "This sandbox credential has already been claimed by a durable workspace"
          );
        }

        const currentPeriodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const currentPeriodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
        await tx.createOrganisation({
          organisation: {
            id: ids.organisationId,
            name: claim.workspace.name,
            slug: input.organisation.slug
          },
          owner: {
            id: ids.ownerId,
            name: input.owner.name,
            email: input.owner.email.toLowerCase()
          },
          subscription: {
            id: ids.subscriptionId,
            currentPeriodStart,
            currentPeriodEnd
          }
        });
        await tx.createUserCredential({
          id: ids.ownerCredentialId,
          userId: ids.ownerId,
          keyPrefix: ownerCredential.keyPrefix,
          keyHash: hashApiKey(ownerCredential.apiKey, this.apiKeyPepper)
        });
        await tx.createAgent({
          id: ids.agentId,
          organisationId: ids.organisationId,
          name: claim.agent.name,
          slug: claim.agent.slug,
          description: "Imported from a verified CAPYN sandbox commissioning session."
        });
        await tx.createCredential({
          id: ids.agentCredentialId,
          agentId: ids.agentId,
          keyPrefix: agentCredential.keyPrefix,
          keyHash: hashApiKey(agentCredential.apiKey, this.apiKeyPepper)
        });
        const mandate = await tx.createActiveMandate({
          id: ids.mandateId,
          policyId: ids.policyId,
          organisationId: ids.organisationId,
          agentId: ids.agentId,
          name: claim.mandate.name,
          validFrom: now,
          validUntil: mandateValidUntil,
          createdBy: ids.ownerId,
          capabilities: [...claim.mandate.capabilities],
          allowedVendors: claim.mandate.allowedVendors.map((vendor) => ({ ...vendor })),
          currency: "USD",
          perTransactionLimitMinor: moneyToMinorUnits(claim.mandate.limits.perTransaction, "USD"),
          dailyLimitMinor: moneyToMinorUnits(claim.mandate.limits.daily, "USD"),
          monthlyLimitMinor: moneyToMinorUnits(claim.mandate.limits.monthly, "USD"),
          approvalThresholdMinor: moneyToMinorUnits(claim.mandate.limits.approvalAbove, "USD")
        });
        const record = await tx.createProductionLaunch({
          id: ids.launchId,
          sandboxCredentialHash,
          idempotencyKey,
          requestHash,
          organisationId: ids.organisationId,
          ownerId: ids.ownerId,
          agentId: ids.agentId,
          mandateId: mandate.id,
          ownerCredentialId: ids.ownerCredentialId,
          agentCredentialId: ids.agentCredentialId,
          mandateValidUntil,
          planIntent: input.planIntent
        });

        await this.appendLaunchAudit(tx, record, claim, input);
        return { record, replayed: false };
      });
    } catch (error) {
      if (error instanceof ConflictError) throw error;
      if (error instanceof Error && error.message.toLowerCase().includes("unique")) {
        const replay = await this.repository.transaction(async (tx) =>
          tx.findProductionLaunchBySandboxHash(sandboxCredentialHash)
        );
        if (replay?.idempotencyKey === idempotencyKey) {
          this.assertReplay(replay, sandboxCredentialHash, requestHash);
          provisioned = { record: replay, replayed: true };
        } else if (replay) {
          throw new ConflictError(
            "SANDBOX_ALREADY_LAUNCHED",
            "This sandbox credential has already been claimed by a durable workspace"
          );
        } else if (error.message.toLowerCase().includes("slug")) {
          throw new ConflictError(
            "ORGANISATION_SLUG_EXISTS",
            "That workspace slug is already in use"
          );
        } else {
          throw new ConflictError(
            "PRODUCTION_LAUNCH_CONFLICT",
            "The durable workspace could not be claimed safely"
          );
        }
      } else {
        throw error;
      }
    }

    return this.buildResult(provisioned, claim, input);
  }

  private assertReplay(
    record: ProductionLaunchRecord,
    sandboxCredentialHash: string,
    requestHash: string
  ): void {
    if (record.sandboxCredentialHash !== sandboxCredentialHash || record.requestHash !== requestHash) {
      throw new ConflictError(
        "IDEMPOTENCY_CONFLICT",
        "This Idempotency-Key was already used for a different production launch"
      );
    }
  }

  private async appendLaunchAudit(
    tx: CapynTransaction,
    record: ProductionLaunchRecord,
    claim: SandboxCredentialClaim,
    input: ProductionLaunchRequest
  ): Promise<void> {
    const timestamp = this.clock();
    const events = [
      {
        eventType: "PRODUCTION_WORKSPACE_LAUNCHED",
        entityType: "Organisation",
        entityId: record.organisationId,
        metadata: {
          importedFrom: "STATELESS_SANDBOX",
          sandboxWorkspaceId: claim.workspace.id,
          planIntent: input.planIntent
        }
      },
      {
        eventType: "OWNER_ACCESS_KEY_CREATED",
        entityType: "UserCredential",
        entityId: record.ownerCredentialId,
        metadata: { keyPrefix: deriveOwnerAccessKey(record.ownerCredentialId, this.apiKeyPepper).keyPrefix }
      },
      {
        eventType: "AGENT_CREATED",
        entityType: "Agent",
        entityId: record.agentId,
        metadata: { name: claim.agent.name, slug: claim.agent.slug }
      },
      {
        eventType: "API_KEY_CREATED",
        entityType: "AgentCredential",
        entityId: record.agentCredentialId,
        metadata: {
          agentId: record.agentId,
          keyPrefix: deriveOnboardingAgentApiKey(record.agentCredentialId, this.apiKeyPepper).keyPrefix
        }
      },
      {
        eventType: "MANDATE_ACTIVATED",
        entityType: "Mandate",
        entityId: record.mandateId,
        metadata: { agentId: record.agentId, version: 1, capabilities: claim.mandate.capabilities }
      }
    ] as const;
    for (const event of events) {
      await tx.appendAudit({
        id: createId("evt"),
        organisationId: record.organisationId,
        actorType: "USER",
        actorId: record.ownerId,
        timestamp,
        ...event
      });
    }
  }

  private async buildResult(
    provisioned: ProvisionedLaunch,
    claim: SandboxCredentialClaim,
    input: ProductionLaunchRequest
  ): Promise<ProductionLaunchResult> {
    const { record } = provisioned;
    const ownerCredential = deriveOwnerAccessKey(record.ownerCredentialId, this.apiKeyPepper);
    const agentCredential = deriveOnboardingAgentApiKey(record.agentCredentialId, this.apiKeyPepper);
    let checkoutUrl: string | null = null;
    let checkoutAvailable = false;
    let billingNote = "Developer is active now. No payment method is required.";

    if (input.planIntent === "TEAM" || input.planIntent === "BUSINESS") {
      const principal: UserPrincipal = {
        type: "USER",
        organisationId: record.organisationId,
        userId: record.ownerId,
        role: "OWNER"
      };
      try {
        const checkout = await this.billing.createCheckout(
          principal,
          input.planIntent,
          `launch-${requestFingerprint({ idempotencyKey: record.idempotencyKey, plan: input.planIntent })}`
        );
        checkoutUrl = checkout.url;
        checkoutAvailable = true;
        billingNote = `${input.planIntent === "TEAM" ? "Team" : "Business"} activates after verified checkout; Developer remains active until then.`;
      } catch (error) {
        if (!(error instanceof BillingUnavailableError)) throw error;
        billingNote = `${input.planIntent === "TEAM" ? "Team" : "Business"} intent is recorded. Developer is active while hosted checkout is being configured.`;
      }
    }

    return {
      mode: "HOSTED_ALPHA",
      scope: "DURABLE_WORKSPACE",
      replayed: provisioned.replayed,
      createdAt: record.createdAt.toISOString(),
      workspace: {
        id: record.organisationId,
        name: claim.workspace.name,
        slug: input.organisation.slug,
        persistence: this.persistence
      },
      owner: {
        id: record.ownerId,
        name: input.owner.name,
        email: input.owner.email.toLowerCase(),
        role: "OWNER"
      },
      agent: {
        id: record.agentId,
        name: claim.agent.name,
        slug: claim.agent.slug,
        status: "ACTIVE"
      },
      mandate: {
        id: record.mandateId,
        name: claim.mandate.name,
        version: 1,
        validUntil: record.mandateValidUntil.toISOString(),
        capabilities: [...claim.mandate.capabilities]
      },
      credentials: {
        owner: {
          id: record.ownerCredentialId,
          apiKey: ownerCredential.apiKey,
          keyPrefix: ownerCredential.keyPrefix,
          scope: "OWNER_CONTROL_PLANE"
        },
        agent: {
          id: record.agentCredentialId,
          apiKey: agentCredential.apiKey,
          keyPrefix: agentCredential.keyPrefix,
          scope: "AGENT_AUTHORIZATION"
        }
      },
      billing: {
        planIntent: input.planIntent,
        activePlan: "DEVELOPER",
        checkoutAvailable,
        checkoutUrl,
        note: billingNote
      },
      handoff: {
        dashboardPath: "/dashboard",
        importedFrom: "STATELESS_SANDBOX",
        sandboxCredentialConsumed: true
      }
    };
  }
}
