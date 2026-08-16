import type { CapynRepository } from "@capyn/database";
import { evaluatePolicy } from "@capyn/policy-engine";
import type { ApprovalDecisionRequest, ApprovalView, NormalizedAuthorizationRequest, UserPrincipal } from "@capyn/types";
import { ConflictError, GoneError, NotFoundError } from "../http/errors";
import { createId } from "./ids";

type ApprovalOutcome =
  | { kind: "completed" }
  | { kind: "expired" }
  | { kind: "invalidated"; reasons: string[] };

export class ApprovalService {
  constructor(
    private readonly repository: CapynRepository,
    private readonly clock: () => Date = () => new Date()
  ) {}

  async decide(
    principal: UserPrincipal,
    approvalId: string,
    request: ApprovalDecisionRequest
  ): Promise<ApprovalView> {
    const now = this.clock();
    const outcome = await this.repository.transaction<ApprovalOutcome>(async (tx) => {
      const candidateApproval = await tx.findApproval(approvalId);
      if (!candidateApproval || candidateApproval.organisationId !== principal.organisationId) {
        throw new NotFoundError("Approval request not found");
      }
      const candidateAuthorization = await tx.findAuthorization(candidateApproval.authorizationId);
      if (!candidateAuthorization || candidateAuthorization.organisationId !== principal.organisationId) {
        throw new NotFoundError("Authorization not found");
      }
      await tx.lockAgent(candidateAuthorization.agentId);

      // Re-read after acquiring the agent lock. A concurrent approver may have
      // committed while this transaction waited, and stale pre-lock state must
      // never authorize the same request twice.
      const approval = await tx.findApproval(approvalId);
      if (!approval || approval.organisationId !== principal.organisationId) {
        throw new NotFoundError("Approval request not found");
      }
      if (approval.status !== "PENDING") {
        throw new ConflictError("APPROVAL_ALREADY_DECIDED", "This approval request has already been decided");
      }
      const authorization = await tx.findAuthorization(approval.authorizationId);
      if (!authorization || authorization.organisationId !== principal.organisationId) {
        throw new NotFoundError("Authorization not found");
      }
      if (authorization.state !== "AWAITING_APPROVAL") {
        throw new ConflictError("AUTHORIZATION_NOT_AWAITING_APPROVAL", "Authorization is not awaiting approval");
      }

      if (!authorization.expiresAt || authorization.expiresAt <= now) {
        await tx.updateApproval(approval.id, {
          status: "EXPIRED",
          decidedAt: now,
          decidedBy: principal.userId,
          comment: request.comment ?? null
        });
        await tx.updateAuthorization(authorization.id, { state: "EXPIRED", expiresAt: authorization.expiresAt });
        await tx.appendAudit({
          id: createId("evt"),
          organisationId: principal.organisationId,
          actorType: "SYSTEM",
          actorId: null,
          eventType: "APPROVAL_EXPIRED",
          entityType: "Approval",
          entityId: approval.id,
          timestamp: now,
          metadata: { authorizationId: authorization.id }
        });
        return { kind: "expired" };
      }

      if (request.decision === "REJECT") {
        await tx.updateApproval(approval.id, {
          status: "REJECTED",
          decidedAt: now,
          decidedBy: principal.userId,
          comment: request.comment ?? null
        });
        await tx.updateAuthorization(authorization.id, { state: "REJECTED", expiresAt: null });
        await tx.appendAudit({
          id: createId("evt"),
          organisationId: principal.organisationId,
          actorType: "USER",
          actorId: principal.userId,
          eventType: "APPROVAL_REJECTED",
          entityType: "Approval",
          entityId: approval.id,
          timestamp: now,
          metadata: { authorizationId: authorization.id, comment: request.comment ?? null }
        });
        return { kind: "completed" };
      }

      const normalized: NormalizedAuthorizationRequest = {
        capability: authorization.capability,
        amountMinor: authorization.amountMinor,
        currency: authorization.currency,
        vendor: { id: authorization.vendorId, name: authorization.vendorName },
        metadata: authorization.metadata
      };
      const context = await tx.loadPolicyContext(authorization.agentId, authorization.currency, now);
      const currentEvaluation = evaluatePolicy({
        ...context,
        request: normalized,
        approvalAlreadyGranted: true
      });
      const mandateStillBound =
        authorization.mandateId !== null && context.mandate?.id === authorization.mandateId;
      if (!mandateStillBound || currentEvaluation.decision !== "ALLOW") {
        const reasons = mandateStillBound
          ? currentEvaluation.reasonCodes
          : ["AUTHORIZATION_MANDATE_CHANGED"];
        await tx.updateApproval(approval.id, {
          status: "EXPIRED",
          decidedAt: now,
          decidedBy: principal.userId,
          comment: request.comment ?? null
        });
        await tx.updateAuthorization(authorization.id, { state: "EXPIRED", expiresAt: null });
        await tx.appendAudit({
          id: createId("evt"),
          organisationId: principal.organisationId,
          actorType: "SYSTEM",
          actorId: null,
          eventType: "APPROVAL_INVALIDATED",
          entityType: "Approval",
          entityId: approval.id,
          timestamp: now,
          metadata: { authorizationId: authorization.id, reasonCodes: reasons }
        });
        return { kind: "invalidated", reasons };
      }

      await tx.updateApproval(approval.id, {
        status: "APPROVED",
        decidedAt: now,
        decidedBy: principal.userId,
        comment: request.comment ?? null
      });
      await tx.updateAuthorization(authorization.id, {
        state: "APPROVED",
        expiresAt: new Date(now.getTime() + 15 * 60_000)
      });
      await tx.appendAudit({
        id: createId("evt"),
        organisationId: principal.organisationId,
        actorType: "USER",
        actorId: principal.userId,
        eventType: "APPROVAL_GRANTED",
        entityType: "Approval",
        entityId: approval.id,
        timestamp: now,
        metadata: { authorizationId: authorization.id, comment: request.comment ?? null }
      });
      return { kind: "completed" };
    });

    if (outcome.kind === "expired") {
      throw new GoneError("APPROVAL_EXPIRED", "This approval request has expired");
    }
    if (outcome.kind === "invalidated") {
      throw new ConflictError(
        "AUTHORIZATION_NO_LONGER_VALID",
        `The request no longer satisfies its hard policy rules: ${outcome.reasons.join(", ")}`
      );
    }
    const view = await this.repository.getApprovalView(principal.organisationId, approvalId);
    if (!view) throw new NotFoundError("Approval request not found");
    return view;
  }
}
