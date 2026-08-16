import type { CapynRepository, StoredAuthorization, StoredExecution } from "@capyn/database";
import type { AgentPrincipal, ExecutionResultView } from "@capyn/types";
import { ConflictError, GoneError, NotFoundError } from "../http/errors";
import { createId } from "./ids";

export interface ExecutionRequest {
  executionId: string;
  authorizationId: string;
  organisationId: string;
  agentId: string;
  capability: string;
  amountMinor: string;
  currency: "USD";
  vendor: { id: string; name: string | null };
}

export interface PaymentExecutionResult {
  status: "EXECUTED" | "FAILED";
  reference: string | null;
  errorCode: string | null;
}

export interface PaymentExecutor {
  readonly name: string;
  execute(request: ExecutionRequest): Promise<PaymentExecutionResult>;
}

export class MockPaymentExecutor implements PaymentExecutor {
  readonly name = "mock";

  async execute(request: ExecutionRequest): Promise<PaymentExecutionResult> {
    return {
      status: "EXECUTED",
      reference: `mock_${request.executionId}`,
      errorCode: null
    };
  }
}

function toView(execution: StoredExecution): ExecutionResultView {
  return {
    executionId: execution.id,
    authorizationId: execution.authorizationId,
    status: execution.status === "PENDING" ? "FAILED" : execution.status,
    provider: execution.provider,
    reference: execution.externalReference,
    executedAt: execution.completedAt?.toISOString() ?? null
  };
}

type ClaimOutcome =
  | { kind: "claimed"; execution: StoredExecution; authorization: StoredAuthorization }
  | { kind: "existing"; execution: StoredExecution }
  | { kind: "expired" };

export class ExecutionService {
  constructor(
    private readonly repository: CapynRepository,
    private readonly executor: PaymentExecutor = new MockPaymentExecutor(),
    private readonly clock: () => Date = () => new Date()
  ) {}

  async execute(principal: AgentPrincipal, authorizationId: string): Promise<ExecutionResultView> {
    const now = this.clock();
    const claim = await this.repository.transaction<ClaimOutcome>(async (tx) => {
      const authorization = await tx.findAuthorization(authorizationId);
      if (
        !authorization ||
        authorization.organisationId !== principal.organisationId ||
        authorization.agentId !== principal.agentId
      ) {
        throw new NotFoundError("Authorization not found");
      }
      await tx.lockAgent(authorization.agentId);
      const existing = await tx.findExecutionByAuthorization(authorization.id);
      if (existing) return { kind: "existing", execution: existing };
      if (authorization.expiresAt && authorization.expiresAt <= now) {
        await tx.updateAuthorization(authorization.id, { state: "EXPIRED", expiresAt: authorization.expiresAt });
        await tx.appendAudit({
          id: createId("evt"),
          organisationId: principal.organisationId,
          actorType: "SYSTEM",
          actorId: null,
          eventType: "AUTHORIZATION_EXPIRED",
          entityType: "Authorization",
          entityId: authorization.id,
          timestamp: now,
          metadata: {}
        });
        return { kind: "expired" };
      }
      if (authorization.state !== "ALLOWED" && authorization.state !== "APPROVED") {
        throw new ConflictError(
          "AUTHORIZATION_NOT_EXECUTABLE",
          `Authorization in state ${authorization.state} cannot be executed`
        );
      }
      const execution = await tx.createExecution({
        id: createId("exe"),
        organisationId: principal.organisationId,
        authorizationId: authorization.id,
        provider: this.executor.name
      });
      await tx.updateAuthorization(authorization.id, { state: "EXECUTING", expiresAt: authorization.expiresAt });
      return { kind: "claimed", execution, authorization };
    });

    if (claim.kind === "expired") throw new GoneError("AUTHORIZATION_EXPIRED", "Authorization has expired");
    if (claim.kind === "existing") {
      if (claim.execution.status === "PENDING") {
        throw new ConflictError("EXECUTION_IN_PROGRESS", "Execution is already in progress");
      }
      return toView(claim.execution);
    }

    let result: PaymentExecutionResult;
    try {
      result = await this.executor.execute({
        executionId: claim.execution.id,
        authorizationId: claim.authorization.id,
        organisationId: claim.authorization.organisationId,
        agentId: claim.authorization.agentId,
        capability: claim.authorization.capability,
        amountMinor: claim.authorization.amountMinor,
        currency: claim.authorization.currency,
        vendor: { id: claim.authorization.vendorId, name: claim.authorization.vendorName }
      });
    } catch {
      result = { status: "FAILED", reference: null, errorCode: "EXECUTOR_ERROR" };
    }

    const completedAt = this.clock();
    return this.repository.transaction(async (tx) => {
      await tx.lockAgent(claim.authorization.agentId);
      const execution = await tx.updateExecution(claim.execution.id, {
        status: result.status,
        externalReference: result.reference,
        errorCode: result.errorCode,
        completedAt
      });
      await tx.updateAuthorization(claim.authorization.id, {
        state: result.status === "EXECUTED" ? "EXECUTED" : "FAILED",
        expiresAt: claim.authorization.expiresAt
      });
      await tx.appendAudit({
        id: createId("evt"),
        organisationId: principal.organisationId,
        actorType: "AGENT",
        actorId: principal.agentId,
        eventType: "EXECUTION_RECORDED",
        entityType: "Execution",
        entityId: execution.id,
        timestamp: completedAt,
        metadata: {
          authorizationId: claim.authorization.id,
          provider: this.executor.name,
          status: result.status,
          reference: result.reference
        }
      });
      return toView(execution);
    });
  }
}
