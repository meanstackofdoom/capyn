import { createHash, randomUUID } from "node:crypto";
import { evaluatePolicy } from "@capyn/policy-engine";
import {
  describeReasons,
  moneyToMinorUnits,
  type LabApprovalDecision,
  type LabEvaluationResult,
  type LabEvaluateRequest,
  type LabEvidence,
  type LabEvidenceEvent,
  type LabMandateView,
  type LabResolutionResult,
  type PolicyEvaluationInput
} from "@capyn/types";
import { canonicalJson } from "./canonical-json";
import { ConflictError, GoneError, NotFoundError } from "../http/errors";

const LAB_NOTICE = "Synthetic, ephemeral demonstration. No customer funds, provider credentials, persistent records, or real execution.";
const APPROVAL_TTL_MS = 10 * 60 * 1_000;
const MAX_PENDING_APPROVALS = 500;
const DAILY_SPEND_MINOR = "4280";
const MONTHLY_SPEND_MINOR = "48320";

const mandate: LabMandateView = {
  id: "lab_mandate_procurement_v3",
  name: "Procurement / bounded compute",
  version: 3,
  capabilities: ["spend.compute", "spend.api"],
  allowedVendors: [
    { id: "openai", name: "OpenAI" },
    { id: "anthropic", name: "Anthropic" },
    { id: "aws", name: "AWS" }
  ],
  limits: {
    perTransaction: "150.00",
    daily: "200.00",
    monthly: "2000.00",
    approvalAbove: "100.00"
  },
  observedSpend: {
    today: "42.80",
    month: "483.20"
  }
};

interface PendingApproval {
  approvalId: string;
  authorizationId: string;
  request: LabEvaluateRequest;
  openedAt: string;
  expiresAt: string;
  initialEvents: LabEvidenceEvent[];
  decided: boolean;
}

function id(prefix: "auth" | "apr" | "rcpt"): string {
  return `lab_${prefix}_${randomUUID().replaceAll("-", "")}`;
}

function makeEvent(
  sequence: number,
  type: LabEvidenceEvent["type"],
  actor: LabEvidenceEvent["actor"],
  timestamp: string,
  detail: string
): LabEvidenceEvent {
  return { sequence, type, actor, timestamp, detail };
}

function evidence(authorizationId: string, request: LabEvaluateRequest, events: LabEvidenceEvent[]): LabEvidence {
  const receiptId = id("rcpt");
  const digest = createHash("sha256")
    .update(canonicalJson({ authorizationId, receiptId, request, events }), "utf8")
    .digest("hex");
  return { receiptId, digest, events };
}

function policyInput(request: LabEvaluateRequest, now: Date, approvalAlreadyGranted: boolean): PolicyEvaluationInput {
  return {
    now: now.toISOString(),
    agent: { id: "lab_agent_procurement", status: "ACTIVE" },
    activeMandateCount: 1,
    mandate: {
      id: mandate.id,
      name: mandate.name,
      version: mandate.version,
      status: "ACTIVE",
      validFrom: new Date(now.getTime() - 24 * 60 * 60 * 1_000).toISOString(),
      validUntil: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1_000).toISOString(),
      capabilities: [...mandate.capabilities],
      policy: {
        currency: "USD",
        allowedVendorIds: mandate.allowedVendors.map((vendor) => vendor.id),
        perTransactionLimitMinor: moneyToMinorUnits(mandate.limits.perTransaction, "USD"),
        dailyLimitMinor: moneyToMinorUnits(mandate.limits.daily, "USD"),
        monthlyLimitMinor: moneyToMinorUnits(mandate.limits.monthly, "USD"),
        approvalThresholdMinor: moneyToMinorUnits(mandate.limits.approvalAbove, "USD")
      }
    },
    request: {
      capability: request.capability,
      amountMinor: moneyToMinorUnits(request.amount.value, request.amount.currency),
      currency: request.amount.currency,
      vendor: { id: request.vendor.id, name: request.vendor.name ?? null },
      metadata: { purpose: request.purpose }
    },
    spend: { dailyMinor: DAILY_SPEND_MINOR, monthlyMinor: MONTHLY_SPEND_MINOR },
    approvalAlreadyGranted
  };
}

export class LabService {
  private readonly pending = new Map<string, PendingApproval>();

  constructor(private readonly clock: () => Date = () => new Date()) {}

  evaluate(request: LabEvaluateRequest): LabEvaluationResult {
    const now = this.clock();
    this.prune(now);
    const evaluatedAt = now.toISOString();
    const authorizationId = id("auth");
    const result = evaluatePolicy(policyInput(request, now, false));
    const events: LabEvidenceEvent[] = [
      makeEvent(1, "REQUEST_RECEIVED", "procurement-agent", evaluatedAt, `${request.capability} · $${request.amount.value} → ${request.vendor.name ?? request.vendor.id}`),
      makeEvent(2, "POLICY_EVALUATED", "CAPYN policy engine", evaluatedAt, result.decision)
    ];

    let approval: LabEvaluationResult["approval"] = null;
    let outcome: LabEvaluationResult["outcome"];
    if (result.decision === "REQUIRE_APPROVAL") {
      const approvalId = id("apr");
      const expiresAt = new Date(now.getTime() + APPROVAL_TTL_MS).toISOString();
      events.push(makeEvent(3, "APPROVAL_OPENED", "CAPYN policy engine", evaluatedAt, "Exact request held for one human decision"));
      approval = { id: approvalId, expiresAt };
      this.makeRoom();
      this.pending.set(approvalId, {
        approvalId,
        authorizationId,
        request,
        openedAt: evaluatedAt,
        expiresAt,
        initialEvents: [...events],
        decided: false
      });
      outcome = "AWAITING_HUMAN";
    } else if (result.decision === "ALLOW") {
      events.push(makeEvent(3, "EXECUTION_SIMULATED", "synthetic executor", evaluatedAt, "Allowed action reached the mock execution boundary"));
      outcome = "SIMULATED_EXECUTION";
    } else {
      events.push(makeEvent(3, "REQUEST_STOPPED", "CAPYN policy engine", evaluatedAt, "Denied before execution"));
      outcome = "STOPPED";
    }

    return {
      mode: "SYNTHETIC",
      notice: LAB_NOTICE,
      authorizationId,
      evaluatedAt,
      agent: { id: "lab_agent_procurement", name: "procurement-agent", status: "ACTIVE" },
      mandate,
      request,
      decision: result.decision,
      reasonCodes: result.reasonCodes,
      reasons: describeReasons(result.reasonCodes),
      trace: result.trace,
      outcome,
      approval,
      evidence: evidence(authorizationId, request, events)
    };
  }

  resolve(approvalId: string, input: LabApprovalDecision): LabResolutionResult {
    const now = this.clock();
    this.prune(now, approvalId);
    const pending = this.pending.get(approvalId);
    if (!pending) throw new NotFoundError("Lab approval not found");
    if (pending.decided) {
      throw new ConflictError("LAB_APPROVAL_ALREADY_DECIDED", "This synthetic approval has already been decided");
    }

    pending.decided = true;
    const resolvedAt = now.toISOString();
    const approved = input.decision === "APPROVE";
    const result = approved
      ? evaluatePolicy(policyInput(pending.request, now, true))
      : evaluatePolicy(policyInput(pending.request, now, false));
    if (approved && result.decision !== "ALLOW") {
      throw new ConflictError("LAB_REQUEST_NO_LONGER_VALID", "The held request no longer passes its hard policy gates");
    }

    const events = [
      ...pending.initialEvents,
      makeEvent(
        pending.initialEvents.length + 1,
        "APPROVAL_RECORDED",
        "human approver",
        resolvedAt,
        approved ? "APPROVED · exact request only" : "REJECTED · request remains stopped"
      ),
      makeEvent(
        pending.initialEvents.length + 2,
        approved ? "EXECUTION_SIMULATED" : "REQUEST_STOPPED",
        approved ? "synthetic executor" : "CAPYN policy engine",
        resolvedAt,
        approved ? "Approved action reached the mock execution boundary" : "Human rejection closed the request"
      )
    ];

    return {
      mode: "SYNTHETIC",
      notice: LAB_NOTICE,
      authorizationId: pending.authorizationId,
      approvalId,
      resolvedAt,
      request: pending.request,
      resolution: approved ? "APPROVED" : "REJECTED",
      policyDecision: approved ? "ALLOW" : "REQUIRE_APPROVAL",
      outcome: approved ? "SIMULATED_EXECUTION" : "STOPPED",
      reasonCodes: result.reasonCodes,
      reasons: describeReasons(result.reasonCodes),
      trace: result.trace,
      evidence: evidence(pending.authorizationId, pending.request, events)
    };
  }

  private prune(now: Date, requestedApprovalId?: string): void {
    for (const [approvalId, approval] of this.pending) {
      if (Date.parse(approval.expiresAt) > now.getTime()) continue;
      this.pending.delete(approvalId);
      if (approvalId === requestedApprovalId) {
        throw new GoneError("LAB_APPROVAL_EXPIRED", "This synthetic approval expired; evaluate the request again");
      }
    }
  }

  private makeRoom(): void {
    if (this.pending.size < MAX_PENDING_APPROVALS) return;
    const oldest = this.pending.keys().next().value;
    if (oldest) this.pending.delete(oldest);
  }
}
