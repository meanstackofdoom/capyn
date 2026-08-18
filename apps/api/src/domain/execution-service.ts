import type { CapynRepository, StoredAuthorization, StoredExecution } from "@capyn/database";
import {
  ExecutionClaimError,
  createEphemeralExecutionAuthority,
  executionActionHash,
  executionClaimId,
  type ExecutionClaimContext,
  type ExecutionClaimIssuer,
  type ExecutionGate
} from "@capyn/gate";
import { evaluatePolicy } from "@capyn/policy-engine";
import type {
  AgentPrincipal,
  ExecutionResultView,
  JsonValue,
  NormalizedAuthorizationRequest
} from "@capyn/types";
import { AuthenticationError, ConflictError, GoneError, NotFoundError } from "../http/errors";
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
  metadata: Record<string, JsonValue>;
  mandateId: string;
  requestHash: string;
  attemptCount: number;
}

export interface PaymentExecutionResult {
  status: "EXECUTED" | "FAILED" | "UNKNOWN";
  reference: string | null;
  errorCode: string | null;
}

export interface PaymentExecutor {
  readonly name: string;
  execute(request: ExecutionRequest): Promise<PaymentExecutionResult>;
  reconcile(request: ExecutionRequest): Promise<PaymentExecutionResult>;
}

export interface ExecutionAuthority {
  issuer: ExecutionClaimIssuer;
  gate: ExecutionGate;
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

  async reconcile(request: ExecutionRequest): Promise<PaymentExecutionResult> {
    return {
      status: "EXECUTED",
      reference: `mock_${request.executionId}`,
      errorCode: null
    };
  }
}

function toView(execution: StoredExecution): ExecutionResultView {
  if (execution.status === "PENDING") throw new Error("A pending execution has no final result");
  return {
    executionId: execution.id,
    authorizationId: execution.authorizationId,
    status: execution.status,
    provider: execution.provider,
    reference: execution.externalReference,
    executedAt: execution.completedAt?.toISOString() ?? null
  };
}

type ClaimOutcome =
  | { kind: "claimed"; execution: StoredExecution; authorization: StoredAuthorization }
  | { kind: "recovering"; execution: StoredExecution; authorization: StoredAuthorization }
  | { kind: "existing"; execution: StoredExecution }
  | { kind: "expired" }
  | { kind: "invalidated"; reasons: string[] };

function subtractReservation(total: string, authorization: StoredAuthorization, periodStart: Date): string {
  if (authorization.createdAt < periodStart) return total;
  const remaining = BigInt(total) - BigInt(authorization.amountMinor);
  return (remaining > 0n ? remaining : 0n).toString();
}

export const DEFAULT_EXECUTION_LEASE_MS = 30_000;

function executionRequest(execution: StoredExecution, authorization: StoredAuthorization): ExecutionRequest {
  if (!authorization.mandateId) throw new Error("An executable authorization must remain bound to a mandate");
  return {
    executionId: execution.id,
    authorizationId: authorization.id,
    organisationId: authorization.organisationId,
    agentId: authorization.agentId,
    capability: authorization.capability,
    amountMinor: authorization.amountMinor,
    currency: authorization.currency,
    vendor: { id: authorization.vendorId, name: authorization.vendorName },
    metadata: authorization.metadata,
    mandateId: authorization.mandateId,
    requestHash: authorization.requestHash,
    attemptCount: execution.attemptCount
  };
}

function executionClaimContext(
  request: ExecutionRequest,
  operation: "EXECUTE" | "RECONCILE"
): ExecutionClaimContext {
  return {
    operation,
    organisationId: request.organisationId,
    agentId: request.agentId,
    mandateId: request.mandateId,
    authorizationId: request.authorizationId,
    executionId: request.executionId,
    attempt: request.attemptCount,
    action: {
      capability: request.capability,
      amountMinor: request.amountMinor,
      currency: request.currency,
      vendor: request.vendor,
      metadata: request.metadata
    }
  };
}

function gateFailureCode(error: unknown): string {
  return error instanceof ExecutionClaimError ? `GATE_${error.code}` : "GATE_INTERNAL_ERROR";
}

export class ExecutionService {
  private readonly authority: ExecutionAuthority;

  constructor(
    private readonly repository: CapynRepository,
    private readonly executor: PaymentExecutor = new MockPaymentExecutor(),
    private readonly clock: () => Date = () => new Date(),
    authority?: ExecutionAuthority,
    private readonly leaseMs: number = DEFAULT_EXECUTION_LEASE_MS
  ) {
    if (!Number.isInteger(leaseMs) || leaseMs <= 0) throw new Error("Execution lease must be a positive integer");
    if (!authority && !(executor instanceof MockPaymentExecutor)) {
      throw new Error("A non-mock executor requires an explicitly configured execution authority and Gate");
    }
    this.authority = authority ?? createEphemeralExecutionAuthority({
      issuer: "urn:capyn:control:ephemeral-mock",
      audience: `urn:capyn:gate:${executor.name}`,
      clock
    });
  }

  async execute(principal: AgentPrincipal, authorizationId: string): Promise<ExecutionResultView> {
    const now = this.clock();
    const claim = await this.repository.transaction<ClaimOutcome>(async (tx) => {
      const candidateAuthorization = await tx.findAuthorization(authorizationId);
      if (
        !candidateAuthorization ||
        candidateAuthorization.organisationId !== principal.organisationId ||
        candidateAuthorization.agentId !== principal.agentId
      ) {
        throw new NotFoundError("Authorization not found");
      }
      await tx.lockAgent(candidateAuthorization.agentId);
      const credential = await tx.findCredential(principal.agentId, principal.credentialId);
      if (!credential || credential.revokedAt) {
        throw new AuthenticationError("A valid CAPYN agent API key is required");
      }
      const authorization = await tx.findAuthorization(authorizationId);
      if (
        !authorization ||
        authorization.organisationId !== principal.organisationId ||
        authorization.agentId !== principal.agentId
      ) {
        throw new NotFoundError("Authorization not found");
      }
      const existing = await tx.findExecutionByAuthorization(authorization.id);
      if (existing) {
        if (existing.status !== "PENDING") return { kind: "existing", execution: existing };
        if (existing.provider !== this.executor.name) {
          throw new ConflictError(
            "EXECUTION_PROVIDER_UNAVAILABLE",
            "The executor that owns this pending execution is not available"
          );
        }
        if (existing.leaseExpiresAt && existing.leaseExpiresAt > now) {
          return { kind: "existing", execution: existing };
        }
        const recovering = await tx.claimExecutionRecovery(
          existing.id,
          now,
          new Date(now.getTime() + this.leaseMs)
        );
        if (!recovering) {
          const current = await tx.findExecutionByAuthorization(authorization.id);
          if (!current) throw new Error("Execution disappeared during recovery claim");
          return { kind: "existing", execution: current };
        }
        await tx.appendAudit({
          id: createId("evt"),
          organisationId: principal.organisationId,
          actorType: "SYSTEM",
          actorId: null,
          eventType: "EXECUTION_RECONCILIATION_STARTED",
          entityType: "Execution",
          entityId: recovering.id,
          timestamp: now,
          metadata: {
            authorizationId: authorization.id,
            provider: recovering.provider,
            attemptCount: recovering.attemptCount,
            requestedByAgentId: principal.agentId,
            requestHash: authorization.requestHash,
            mandateId: authorization.mandateId,
            authorityAudience: this.authority.issuer.audience,
            authorityKeyId: this.authority.issuer.keyId,
            authorityClaimId: executionClaimId(
              executionClaimContext(executionRequest(recovering, authorization), "RECONCILE")
            )
          }
        });
        return { kind: "recovering", execution: recovering, authorization };
      }
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

      const request: NormalizedAuthorizationRequest = {
        capability: authorization.capability,
        amountMinor: authorization.amountMinor,
        currency: authorization.currency,
        vendor: { id: authorization.vendorId, name: authorization.vendorName },
        metadata: authorization.metadata
      };
      const context = await tx.loadPolicyContext(authorization.agentId, authorization.currency, now);
      const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const evaluation = evaluatePolicy({
        ...context,
        spend: {
          dailyMinor: subtractReservation(context.spend.dailyMinor, authorization, dayStart),
          monthlyMinor: subtractReservation(context.spend.monthlyMinor, authorization, monthStart)
        },
        request,
        approvalAlreadyGranted: authorization.state === "APPROVED"
      });
      const mandateStillBound =
        authorization.mandateId !== null && context.mandate?.id === authorization.mandateId;
      if (!mandateStillBound || evaluation.decision !== "ALLOW") {
        const reasons = mandateStillBound
          ? evaluation.reasonCodes
          : ["AUTHORIZATION_MANDATE_CHANGED"];
        await tx.updateAuthorization(authorization.id, { state: "EXPIRED", expiresAt: null });
        await tx.appendAudit({
          id: createId("evt"),
          organisationId: principal.organisationId,
          actorType: "SYSTEM",
          actorId: null,
          eventType: "AUTHORIZATION_INVALIDATED",
          entityType: "Authorization",
          entityId: authorization.id,
          timestamp: now,
          metadata: { reasons }
        });
        return { kind: "invalidated", reasons };
      }
      const execution = await tx.createExecution({
        id: createId("exe"),
        organisationId: principal.organisationId,
        authorizationId: authorization.id,
        provider: this.executor.name,
        attemptedAt: now,
        leaseExpiresAt: new Date(now.getTime() + this.leaseMs)
      });
      await tx.updateAuthorization(authorization.id, { state: "EXECUTING", expiresAt: authorization.expiresAt });
      await tx.appendAudit({
        id: createId("evt"),
        organisationId: principal.organisationId,
        actorType: "AGENT",
        actorId: principal.agentId,
        eventType: "EXECUTION_CLAIMED",
        entityType: "Execution",
        entityId: execution.id,
        timestamp: now,
        metadata: {
          authorizationId: authorization.id,
          provider: this.executor.name,
          attemptCount: execution.attemptCount,
          requestHash: authorization.requestHash,
          mandateId: authorization.mandateId,
          authorityAudience: this.authority.issuer.audience,
          authorityKeyId: this.authority.issuer.keyId,
          authorityClaimId: executionClaimId(
            executionClaimContext(executionRequest(execution, authorization), "EXECUTE")
          )
        }
      });
      return { kind: "claimed", execution, authorization };
    });

    if (claim.kind === "expired") throw new GoneError("AUTHORIZATION_EXPIRED", "Authorization has expired");
    if (claim.kind === "invalidated") {
      throw new ConflictError(
        "AUTHORIZATION_NO_LONGER_VALID",
        `Authorization no longer satisfies its execution-time authority checks: ${claim.reasons.join(", ")}`
      );
    }
    if (claim.kind === "existing") {
      if (claim.execution.status === "PENDING") {
        throw new ConflictError("EXECUTION_IN_PROGRESS", "Execution is already in progress");
      }
      return toView(claim.execution);
    }

    const request = executionRequest(claim.execution, claim.authorization);
    const operation = claim.kind === "recovering" ? "RECONCILE" : "EXECUTE";
    const authorityContext = executionClaimContext(request, operation);
    let authorityClaimId = executionClaimId(authorityContext);
    let result: PaymentExecutionResult | null = null;
    try {
      if (executionActionHash(authorityContext.action) !== request.requestHash) {
        throw new ExecutionClaimError(
          "CLAIM_CONTEXT_MISMATCH",
          "The stored authorization fingerprint does not match the execution action"
        );
      }
      const issued = this.authority.issuer.issue(authorityContext);
      authorityClaimId = issued.payload.jti;
      await this.authority.gate.consume(issued.token, authorityContext);
    } catch (error) {
      result = { status: "FAILED", reference: null, errorCode: gateFailureCode(error) };
    }
    if (result === null) {
      try {
        result = claim.kind === "recovering"
          ? await this.executor.reconcile(request)
          : await this.executor.execute(request);
      } catch {
        result = {
          status: "UNKNOWN",
          reference: claim.execution.externalReference,
          errorCode: "PROVIDER_OUTCOME_UNKNOWN"
        };
      }
    }

    const completedAt = this.clock();
    if (result.status === "UNKNOWN") {
      const current = await this.repository.transaction(async (tx) => {
        await tx.lockAgent(claim.authorization.agentId);
        const uncertain = await tx.markExecutionUncertain(claim.execution.id, claim.execution.attemptCount, {
          externalReference: result.reference ?? claim.execution.externalReference,
          errorCode: result.errorCode ?? "PROVIDER_OUTCOME_UNKNOWN",
          leaseExpiresAt: new Date(completedAt.getTime() + this.leaseMs)
        });
        if (!uncertain) {
          const latest = await tx.findExecutionByAuthorization(claim.authorization.id);
          if (!latest) throw new Error("Execution disappeared while recording an uncertain outcome");
          return latest;
        }
        await tx.appendAudit({
          id: createId("evt"),
          organisationId: principal.organisationId,
          actorType: "SYSTEM",
          actorId: null,
          eventType: "EXECUTION_OUTCOME_UNKNOWN",
          entityType: "Execution",
          entityId: uncertain.id,
          timestamp: completedAt,
          metadata: {
            authorizationId: claim.authorization.id,
            provider: this.executor.name,
            attemptCount: uncertain.attemptCount,
            errorCode: uncertain.errorCode,
            authorityClaimId,
            authorityOperation: operation,
            requestHash: request.requestHash
          }
        });
        return uncertain;
      });
      if (current.status !== "PENDING") return toView(current);
      throw new ConflictError(
        "EXECUTION_OUTCOME_UNKNOWN",
        "The provider outcome is not yet known; retry after the execution lease expires to reconcile this exact execution"
      );
    }

    const finalResult = result as PaymentExecutionResult & { status: "EXECUTED" | "FAILED" };
    return this.repository.transaction(async (tx) => {
      await tx.lockAgent(claim.authorization.agentId);
      const execution = await tx.completeExecution(claim.execution.id, claim.execution.attemptCount, {
        status: finalResult.status,
        externalReference: finalResult.reference,
        errorCode: finalResult.errorCode,
        completedAt
      });
      if (!execution) {
        const current = await tx.findExecutionByAuthorization(claim.authorization.id);
        if (!current) throw new Error("Execution disappeared while recording its final outcome");
        if (current.status === "PENDING") {
          throw new ConflictError("EXECUTION_IN_PROGRESS", "A newer execution reconciliation attempt is in progress");
        }
        return toView(current);
      }
      await tx.updateAuthorization(claim.authorization.id, {
        state: finalResult.status === "EXECUTED" ? "EXECUTED" : "FAILED",
        expiresAt: claim.authorization.expiresAt
      });
      await tx.appendAudit({
        id: createId("evt"),
        organisationId: principal.organisationId,
        actorType: "AGENT",
        actorId: principal.agentId,
        eventType: claim.kind === "recovering" ? "EXECUTION_RECONCILED" : "EXECUTION_RECORDED",
        entityType: "Execution",
        entityId: execution.id,
        timestamp: completedAt,
        metadata: {
          authorizationId: claim.authorization.id,
          provider: this.executor.name,
          status: finalResult.status,
          reference: finalResult.reference,
          attemptCount: execution.attemptCount,
          errorCode: finalResult.errorCode,
          authorityClaimId,
          authorityOperation: operation,
          requestHash: request.requestHash
        }
      });
      return toView(execution);
    });
  }
}
