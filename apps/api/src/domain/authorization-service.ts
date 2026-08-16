import type { CapynRepository, StoredAuthorization } from "@capyn/database";
import { evaluatePolicy } from "@capyn/policy-engine";
import {
  describeReasons,
  minorUnitsToMoney,
  moneyToMinorUnits,
  type AgentPrincipal,
  type AuthorizationResult,
  type AuthorizationView,
  type AuthorizeRequest,
  type NormalizedAuthorizationRequest
} from "@capyn/types";
import { ConflictError, InvalidRequestError, NotFoundError } from "../http/errors";
import { requestFingerprint } from "./canonical-json";
import { createId } from "./ids";

const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/;

function toView(auth: StoredAuthorization): AuthorizationView {
  return {
    id: auth.id,
    organisationId: auth.organisationId,
    agentId: auth.agentId,
    agentName: auth.agentName,
    mandateId: auth.mandateId,
    capability: auth.capability,
    amount: { value: minorUnitsToMoney(auth.amountMinor), currency: auth.currency },
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
}

function toResult(auth: StoredAuthorization): AuthorizationResult {
  const base = {
    authorizationId: auth.id,
    reasonCodes: auth.reasonCodes,
    reasons: describeReasons(auth.reasonCodes),
    expiresAt: auth.expiresAt?.toISOString() ?? null
  };
  if (auth.decision === "REQUIRE_APPROVAL") {
    if (!auth.approvalId) throw new Error("Approval decision is missing its approval request");
    return { ...base, decision: "REQUIRE_APPROVAL", approvalId: auth.approvalId };
  }
  return { ...base, decision: auth.decision };
}

export class AuthorizationService {
  constructor(
    private readonly repository: CapynRepository,
    private readonly clock: () => Date = () => new Date()
  ) {}

  async authorize(
    principal: AgentPrincipal,
    request: AuthorizeRequest,
    idempotencyKey: string
  ): Promise<AuthorizationResult> {
    if (!IDEMPOTENCY_KEY.test(idempotencyKey)) {
      throw new InvalidRequestError(
        "INVALID_IDEMPOTENCY_KEY",
        "Idempotency-Key must contain 8-200 URL-safe characters"
      );
    }
    const serializedMetadata = JSON.stringify(request.metadata);
    if (Buffer.byteLength(serializedMetadata, "utf8") > 8_192) {
      throw new InvalidRequestError("METADATA_TOO_LARGE", "Authorization metadata cannot exceed 8 KiB");
    }

    const normalized: NormalizedAuthorizationRequest = {
      capability: request.capability,
      amountMinor: moneyToMinorUnits(request.amount.value, request.amount.currency),
      currency: request.amount.currency,
      vendor: { id: request.vendor.id.toLowerCase(), name: request.vendor.name ?? null },
      metadata: request.metadata
    };
    const fingerprint = requestFingerprint(normalized);
    const now = this.clock();

    return this.repository.transaction(async (tx) => {
      await tx.lockAgent(principal.agentId);
      const agent = await tx.findAgent(principal.agentId);
      if (!agent || agent.organisationId !== principal.organisationId) throw new NotFoundError("Agent not found");

      const existing = await tx.findIdempotentAuthorization(principal.agentId, idempotencyKey);
      if (existing) {
        if (existing.requestHash !== fingerprint) {
          throw new ConflictError(
            "IDEMPOTENCY_CONFLICT",
            "This Idempotency-Key was already used with a different request payload"
          );
        }
        return toResult(existing);
      }

      const context = await tx.loadPolicyContext(principal.agentId, normalized.currency, now);
      const evaluation = evaluatePolicy({
        ...context,
        request: normalized,
        approvalAlreadyGranted: false
      });
      const authorizationId = createId("auth");
      const approvalId = evaluation.decision === "REQUIRE_APPROVAL" ? createId("apr") : null;
      const expiresAt =
        evaluation.decision === "DENY"
          ? null
          : new Date(now.getTime() + (evaluation.decision === "ALLOW" ? 15 * 60_000 : 24 * 60 * 60_000));
      const state =
        evaluation.decision === "ALLOW"
          ? "ALLOWED"
          : evaluation.decision === "DENY"
            ? "DENIED"
            : "AWAITING_APPROVAL";

      await tx.createAuthorization({
        id: authorizationId,
        organisationId: principal.organisationId,
        agentId: principal.agentId,
        mandateId: context.mandate?.id ?? null,
        idempotencyKey,
        requestHash: fingerprint,
        capability: normalized.capability,
        amountMinor: normalized.amountMinor,
        currency: normalized.currency,
        vendorId: normalized.vendor.id,
        vendorName: normalized.vendor.name,
        metadata: normalized.metadata,
        decision: evaluation.decision,
        state,
        reasonCodes: evaluation.reasonCodes,
        trace: evaluation.trace,
        expiresAt
      });
      await tx.appendAudit({
        id: createId("evt"),
        organisationId: principal.organisationId,
        actorType: "AGENT",
        actorId: principal.agentId,
        eventType: "AUTHORIZATION_REQUESTED",
        entityType: "Authorization",
        entityId: authorizationId,
        timestamp: now,
        metadata: {
          capability: normalized.capability,
          amountMinor: normalized.amountMinor,
          currency: normalized.currency,
          vendorId: normalized.vendor.id,
          requestHash: fingerprint
        }
      });

      if (approvalId) {
        await tx.createApproval({
          id: approvalId,
          organisationId: principal.organisationId,
          authorizationId,
          triggeredBy: "APPROVAL_THRESHOLD_EXCEEDED"
        });
        await tx.appendAudit({
          id: createId("evt"),
          organisationId: principal.organisationId,
          actorType: "SYSTEM",
          actorId: null,
          eventType: "APPROVAL_REQUESTED",
          entityType: "Approval",
          entityId: approvalId,
          timestamp: now,
          metadata: { authorizationId, reasonCode: "APPROVAL_THRESHOLD_EXCEEDED" }
        });
      }

      await tx.appendAudit({
        id: createId("evt"),
        organisationId: principal.organisationId,
        actorType: "SYSTEM",
        actorId: null,
        eventType:
          evaluation.decision === "ALLOW"
            ? "AUTHORIZATION_ALLOWED"
            : evaluation.decision === "DENY"
              ? "AUTHORIZATION_DENIED"
              : "AUTHORIZATION_REQUIRES_APPROVAL",
        entityType: "Authorization",
        entityId: authorizationId,
        timestamp: now,
        metadata: { decision: evaluation.decision, reasonCodes: evaluation.reasonCodes }
      });

      const persisted = await tx.findAuthorization(authorizationId);
      if (!persisted) throw new Error("Authorization was not persisted");
      return toResult(persisted);
    });
  }

  async getAuthorization(principal: AgentPrincipal, id: string): Promise<AuthorizationView> {
    const authorization = await this.repository.transaction((tx) => tx.findAuthorization(id));
    if (
      !authorization ||
      authorization.organisationId !== principal.organisationId ||
      authorization.agentId !== principal.agentId
    ) {
      throw new NotFoundError("Authorization not found");
    }
    return toView(authorization);
  }

  async getMe(principal: AgentPrincipal) {
    const data = await this.repository.transaction(async (tx) => {
      const agent = await tx.findAgent(principal.agentId);
      const context = await tx.loadPolicyContext(principal.agentId, "USD", this.clock());
      return { agent, context };
    });
    if (!data.agent || data.agent.organisationId !== principal.organisationId) throw new NotFoundError("Agent not found");
    return {
      id: data.agent.id,
      organisationId: data.agent.organisationId,
      name: data.agent.name,
      slug: data.agent.slug,
      description: data.agent.description,
      status: data.agent.status,
      activeMandateId: data.context.mandate?.id ?? null
    };
  }

  async getMandate(principal: AgentPrincipal) {
    const context = await this.repository.transaction((tx) =>
      tx.loadPolicyContext(principal.agentId, "USD", this.clock())
    );
    if (context.agent.id !== principal.agentId) throw new NotFoundError("Mandate not found");
    return context.mandate;
  }
}
