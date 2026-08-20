import type { CapynRepository, StoredAuthorization, StoredExecution } from "@capyn/database";
import {
  ExecutionClaimError,
  ExecutionGatewayRejectedError,
  LocalExecutionGateway,
  createEphemeralExecutionAuthority,
  executionClaimContextFromRequest,
  executionClaimId,
  type ExecutionGateReceipt,
  type ExecutionGateway,
  type ExecutionClaimIssuer,
  type ExecutionRequest,
  type PaymentExecutionResult,
  type PaymentExecutor
} from "@capyn/gate";
import { evaluatePolicy } from "@capyn/policy-engine";
import type {
  AgentPrincipal,
  ExecutionResultView,
  NormalizedAuthorizationRequest
} from "@capyn/types";
import { AuthenticationError, ConflictError, GoneError, NotFoundError } from "../http/errors";
import { createId } from "./ids";

export type { ExecutionRequest, PaymentExecutionResult, PaymentExecutor } from "@capyn/gate";

export interface ExecutionAuthority {
  issuer: ExecutionClaimIssuer;
  gateway: ExecutionGateway;
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

export interface StaleExecutionSweepResult {
  candidates: number;
  reconciled: number;
  failed: number;
  deferred: number;
  skipped: number;
}

interface RecoveryAuditActor {
  actorType: "AGENT" | "SYSTEM";
  actorId: string | null;
}

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

function gateFailureCode(error: unknown): string {
  if (error instanceof ExecutionClaimError) return `GATE_${error.code}`;
  if (error instanceof ExecutionGatewayRejectedError) return `GATE_${error.code}`;
  return "GATE_INTERNAL_ERROR";
}

function isDefinitiveGatewayRejection(error: unknown): boolean {
  return error instanceof ExecutionGatewayRejectedError ||
    (error instanceof ExecutionClaimError && error.code !== "CLAIM_REPLAYED");
}

export class ExecutionService {
  private readonly authority: ExecutionAuthority;

  constructor(
    private readonly repository: CapynRepository,
    authority?: ExecutionAuthority,
    private readonly clock: () => Date = () => new Date(),
    private readonly leaseMs: number = DEFAULT_EXECUTION_LEASE_MS
  ) {
    if (!Number.isInteger(leaseMs) || leaseMs <= 0) throw new Error("Execution lease must be a positive integer");
    if (authority) {
      this.authority = authority;
      return;
    }
    const executor = new MockPaymentExecutor();
    const ephemeral = createEphemeralExecutionAuthority({
      issuer: "urn:capyn:control:ephemeral-mock",
      audience: `urn:capyn:gate:${executor.name}`,
      clock
    });
    this.authority = {
      issuer: ephemeral.issuer,
      gateway: new LocalExecutionGateway({
        gateId: "capyn-ephemeral-mock-gate",
        gate: ephemeral.gate,
        executor,
        clock
      })
    };
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
        if (existing.provider !== this.authority.gateway.name) {
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
              executionClaimContextFromRequest(executionRequest(recovering, authorization), "RECONCILE")
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
        provider: this.authority.gateway.name,
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
          provider: this.authority.gateway.name,
          attemptCount: execution.attemptCount,
          requestHash: authorization.requestHash,
          mandateId: authorization.mandateId,
          authorityAudience: this.authority.issuer.audience,
          authorityKeyId: this.authority.issuer.keyId,
          authorityClaimId: executionClaimId(
            executionClaimContextFromRequest(executionRequest(execution, authorization), "EXECUTE")
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

    const outcome = await this.dispatchAndFinalize(
      claim.execution,
      claim.authorization,
      claim.kind === "recovering" ? "RECONCILE" : "EXECUTE",
      { actorType: "AGENT", actorId: principal.agentId }
    );
    if (outcome === null) {
      throw new ConflictError(
        "EXECUTION_OUTCOME_UNKNOWN",
        "The provider outcome is not yet known; retry after the execution lease expires to reconcile this exact execution"
      );
    }
    return outcome;
  }

  async sweepStaleExecutions(limit: number): Promise<StaleExecutionSweepResult> {
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new Error("Stale execution sweep limit must be a positive integer");
    }
    const now = this.clock();
    const candidates = await this.repository.findStaleExecutions(now, limit);
    const result: StaleExecutionSweepResult = {
      candidates: candidates.length,
      reconciled: 0,
      failed: 0,
      deferred: 0,
      skipped: 0
    };
    for (const candidate of candidates) {
      try {
        const claim = await this.repository.transaction(async (tx) => {
          const candidateAuthorization = await tx.findAuthorization(candidate.authorizationId);
          if (!candidateAuthorization || candidateAuthorization.organisationId !== candidate.organisationId) {
            return null;
          }
          await tx.lockAgent(candidateAuthorization.agentId);
          const authorization = await tx.findAuthorization(candidate.authorizationId);
          if (!authorization || authorization.organisationId !== candidate.organisationId) return null;
          if (authorization.state !== "EXECUTING") return null;
          const current = await tx.findExecutionByAuthorization(candidate.authorizationId);
          if (
            !current ||
            current.id !== candidate.id ||
            current.status !== "PENDING" ||
            current.provider !== this.authority.gateway.name
          ) {
            return null;
          }
          if (current.leaseExpiresAt && current.leaseExpiresAt > now) return null;
          const recovering = await tx.claimExecutionRecovery(
            current.id,
            now,
            new Date(now.getTime() + this.leaseMs)
          );
          if (!recovering) return null;
          await tx.appendAudit({
            id: createId("evt"),
            organisationId: authorization.organisationId,
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
              requestedByAgentId: null,
              requestHash: authorization.requestHash,
              mandateId: authorization.mandateId,
              authorityAudience: this.authority.issuer.audience,
              authorityKeyId: this.authority.issuer.keyId,
              authorityClaimId: executionClaimId(
                executionClaimContextFromRequest(executionRequest(recovering, authorization), "RECONCILE")
              ),
              sweepSource: "stale-execution-sweep"
            }
          });
          return { execution: recovering, authorization };
        });
        if (!claim) {
          result.skipped += 1;
          continue;
        }
        const outcome = await this.dispatchAndFinalize(claim.execution, claim.authorization, "RECONCILE", {
          actorType: "SYSTEM",
          actorId: null
        });
        if (outcome === null) {
          result.deferred += 1;
          continue;
        }
        if (outcome.status === "EXECUTED") result.reconciled += 1;
        else result.failed += 1;
      } catch {
        result.skipped += 1;
      }
    }
    return result;
  }

  private async dispatchAndFinalize(
    execution: StoredExecution,
    authorization: StoredAuthorization,
    operation: "EXECUTE" | "RECONCILE",
    auditActor: RecoveryAuditActor
  ): Promise<ExecutionResultView | null> {
    const request = executionRequest(execution, authorization);
    let authorityClaimId = "unissued";
    let gateReceipt: ExecutionGateReceipt | null = null;
    let result: PaymentExecutionResult | null = null;
    let issuedClaim: string | null = null;
    try {
      const authorityContext = executionClaimContextFromRequest(request, operation);
      const issued = this.authority.issuer.issue(authorityContext);
      authorityClaimId = issued.payload.jti;
      issuedClaim = issued.token;
    } catch (error) {
      result = { status: "FAILED", reference: null, errorCode: gateFailureCode(error) };
    }
    if (result === null && issuedClaim !== null) {
      try {
        const invocation = await this.authority.gateway.invoke({ claim: issuedClaim, operation, request });
        result = invocation.result;
        gateReceipt = invocation.receipt;
      } catch (error) {
        result = isDefinitiveGatewayRejection(error)
          ? { status: "FAILED", reference: null, errorCode: gateFailureCode(error) }
          : {
              status: "UNKNOWN",
              reference: execution.externalReference,
              errorCode: error instanceof ExecutionClaimError
                ? gateFailureCode(error)
                : "GATEWAY_OUTCOME_UNKNOWN"
            };
      }
    }
    if (result === null) {
      result = { status: "FAILED", reference: null, errorCode: "GATE_INTERNAL_ERROR" };
    }

    const completedAt = this.clock();
    if (result.status === "UNKNOWN") {
      const current = await this.repository.transaction(async (tx) => {
        await tx.lockAgent(authorization.agentId);
        const uncertain = await tx.markExecutionUncertain(execution.id, execution.attemptCount, {
          externalReference: result.reference ?? execution.externalReference,
          errorCode: result.errorCode ?? "PROVIDER_OUTCOME_UNKNOWN",
          leaseExpiresAt: new Date(completedAt.getTime() + this.leaseMs)
        });
        if (!uncertain) {
          const latest = await tx.findExecutionByAuthorization(authorization.id);
          if (!latest) throw new Error("Execution disappeared while recording an uncertain outcome");
          return latest;
        }
        await tx.appendAudit({
          id: createId("evt"),
          organisationId: authorization.organisationId,
          actorType: "SYSTEM",
          actorId: null,
          eventType: "EXECUTION_OUTCOME_UNKNOWN",
          entityType: "Execution",
          entityId: uncertain.id,
          timestamp: completedAt,
          metadata: {
            authorizationId: authorization.id,
            provider: this.authority.gateway.name,
            attemptCount: uncertain.attemptCount,
            errorCode: uncertain.errorCode,
            authorityClaimId,
            authorityOperation: operation,
            requestHash: request.requestHash,
            ...(gateReceipt ? {
              gateId: gateReceipt.gateId,
              gateReceiptHash: gateReceipt.receiptHash,
              gateConsumedAt: gateReceipt.consumedAt
            } : {})
          }
        });
        return uncertain;
      });
      if (current.status !== "PENDING") return toView(current);
      return null;
    }

    const finalResult = result as PaymentExecutionResult & { status: "EXECUTED" | "FAILED" };
    return this.repository.transaction(async (tx) => {
      await tx.lockAgent(authorization.agentId);
      const completed = await tx.completeExecution(execution.id, execution.attemptCount, {
        status: finalResult.status,
        externalReference: finalResult.reference,
        errorCode: finalResult.errorCode,
        completedAt
      });
      if (!completed) {
        const current = await tx.findExecutionByAuthorization(authorization.id);
        if (!current) throw new Error("Execution disappeared while recording its final outcome");
        if (current.status === "PENDING") {
          throw new ConflictError("EXECUTION_IN_PROGRESS", "A newer execution reconciliation attempt is in progress");
        }
        return toView(current);
      }
      await tx.updateAuthorization(authorization.id, {
        state: finalResult.status === "EXECUTED" ? "EXECUTED" : "FAILED",
        expiresAt: authorization.expiresAt
      });
      await tx.appendAudit({
        id: createId("evt"),
        organisationId: authorization.organisationId,
        actorType: auditActor.actorType,
        actorId: auditActor.actorId,
        eventType: operation === "RECONCILE" ? "EXECUTION_RECONCILED" : "EXECUTION_RECORDED",
        entityType: "Execution",
        entityId: completed.id,
        timestamp: completedAt,
        metadata: {
          authorizationId: authorization.id,
          provider: this.authority.gateway.name,
          status: finalResult.status,
          reference: finalResult.reference,
          attemptCount: completed.attemptCount,
          errorCode: finalResult.errorCode,
          authorityClaimId,
          authorityOperation: operation,
          requestHash: request.requestHash,
          ...(gateReceipt ? {
            gateId: gateReceipt.gateId,
            gateReceiptHash: gateReceipt.receiptHash,
            gateConsumedAt: gateReceipt.consumedAt,
            gateCompletedAt: gateReceipt.completedAt
          } : {})
        }
      });
      return toView(completed);
    });
  }
}
