import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID
} from "node:crypto";
import { evaluatePolicy } from "@capyn/policy-engine";
import {
  describeReasons,
  moneyToMinorUnits,
  type LabEvidence,
  type LabEvidenceEvent,
  type LabEvaluateRequest,
  type PolicyEvaluationInput,
  type SandboxActivateRequest,
  type SandboxActivationResult,
  type SandboxEvaluationResult,
  type SandboxMandateView
} from "@capyn/types";
import { z } from "zod";
import { AuthenticationError, GoneError, InvalidRequestError } from "../http/errors";
import { canonicalJson } from "./canonical-json";

const SANDBOX_NOTICE =
  "Synthetic, stateless commissioning session. The credential expires in 30 minutes, creates no account, stores no spend, moves no funds, and cannot authorize production execution.";
const CREDENTIAL_PREFIX = "capyn_sbx_";
const CREDENTIAL_TTL_MS = 30 * 60 * 1_000;
const CREDENTIAL_VERSION = 1;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;
const CREDENTIAL_AAD = Buffer.from("capyn/sandbox/credential/v1", "utf8");

const credentialPayloadSchema = z
  .object({
    schemaVersion: z.literal(CREDENTIAL_VERSION),
    issuedAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    workspace: z.object({ id: z.string().min(1).max(100), name: z.string().min(2).max(120) }).strict(),
    agent: z
      .object({
        id: z.string().min(1).max(100),
        name: z.string().min(2).max(120),
        slug: z.string().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      })
      .strict(),
    mandate: z
      .object({
        id: z.string().min(1).max(100),
        name: z.string().min(2).max(120),
        capabilities: z.array(z.string().min(3).max(100)).min(1).max(8),
        allowedVendors: z
          .array(z.object({ id: z.string().min(1).max(100), name: z.string().min(1).max(160) }).strict())
          .min(1)
          .max(8),
        limits: z
          .object({
            perTransaction: z.string().min(1).max(16),
            daily: z.string().min(1).max(16),
            monthly: z.string().min(1).max(16),
            approvalAbove: z.string().min(1).max(16)
          })
          .strict()
      })
      .strict()
  })
  .strict();

export type SandboxCredentialClaim = z.infer<typeof credentialPayloadSchema>;
type CredentialPayload = SandboxCredentialClaim;

function createId(prefix: "org" | "agt" | "man" | "auth" | "rcpt"): string {
  return `sbx_${prefix}_${randomUUID().replaceAll("-", "")}`;
}

function boundedDetail(value: string): string {
  return value.slice(0, 240);
}

function makeEvent(
  sequence: number,
  type: LabEvidenceEvent["type"],
  actor: string,
  timestamp: string,
  detail: string
): LabEvidenceEvent {
  return { sequence, type, actor, timestamp, detail: boundedDetail(detail) };
}

function evidence(authorizationId: string, request: LabEvaluateRequest, events: LabEvidenceEvent[]): LabEvidence {
  const receiptId = createId("rcpt");
  const digest = createHash("sha256")
    .update(canonicalJson({ authorizationId, receiptId, request, events }), "utf8")
    .digest("hex");
  return { receiptId, digest, events };
}

function encryptionKey(pepper: string): Buffer {
  return createHash("sha256").update("capyn/sandbox/encryption/v1\0", "utf8").update(pepper, "utf8").digest();
}

function publicMandate(payload: CredentialPayload): SandboxMandateView {
  return {
    id: payload.mandate.id,
    name: payload.mandate.name,
    version: 1,
    capabilities: [...payload.mandate.capabilities],
    allowedVendors: payload.mandate.allowedVendors.map((vendor) => ({ ...vendor })),
    limits: { ...payload.mandate.limits },
    observedSpend: { today: "0.00", month: "0.00" },
    validUntil: payload.expiresAt
  };
}

export class SandboxService {
  private readonly key: Buffer;

  constructor(
    apiKeyPepper: string,
    private readonly clock: () => Date = () => new Date()
  ) {
    this.key = encryptionKey(apiKeyPepper);
  }

  activate(input: SandboxActivateRequest): SandboxActivationResult {
    const capabilities = [...new Set(input.mandate.capabilities)];
    const vendors = [
      ...new Map(
        input.mandate.allowedVendors.map((vendor) => [
          vendor.id.toLowerCase(),
          { id: vendor.id.toLowerCase(), name: vendor.name ?? vendor.id }
        ])
      ).values()
    ];
    const firstVendorId = input.firstRequest.vendor.id.toLowerCase();
    if (!capabilities.includes(input.firstRequest.capability)) {
      throw new InvalidRequestError(
        "SANDBOX_CAPABILITY_MISMATCH",
        "The first request capability must be granted by the sandbox mandate"
      );
    }
    if (!vendors.some((vendor) => vendor.id === firstVendorId)) {
      throw new InvalidRequestError(
        "SANDBOX_VENDOR_MISMATCH",
        "The first request vendor must be allowed by the sandbox mandate"
      );
    }

    const transaction = BigInt(moneyToMinorUnits(input.mandate.limits.perTransaction.value, "USD"));
    const daily = BigInt(moneyToMinorUnits(input.mandate.limits.daily.value, "USD"));
    const monthly = BigInt(moneyToMinorUnits(input.mandate.limits.monthly.value, "USD"));
    const approval = BigInt(moneyToMinorUnits(input.mandate.limits.approvalAbove.value, "USD"));
    if (approval > transaction || transaction > daily || daily > monthly) {
      throw new InvalidRequestError(
        "INVALID_LIMITS",
        "Limits must satisfy approval threshold <= transaction <= daily <= monthly"
      );
    }

    const now = this.clock();
    const issuedAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + CREDENTIAL_TTL_MS).toISOString();
    const payload: CredentialPayload = {
      schemaVersion: CREDENTIAL_VERSION,
      issuedAt,
      expiresAt,
      workspace: { id: createId("org"), name: input.organisation.name },
      agent: { id: createId("agt"), name: input.agent.name, slug: input.agent.slug },
      mandate: {
        id: createId("man"),
        name: input.mandate.name,
        capabilities,
        allowedVendors: vendors,
        limits: {
          perTransaction: input.mandate.limits.perTransaction.value,
          daily: input.mandate.limits.daily.value,
          monthly: input.mandate.limits.monthly.value,
          approvalAbove: input.mandate.limits.approvalAbove.value
        }
      }
    };
    const apiKey = this.seal(payload);
    const keyPrefix = apiKey.slice(0, CREDENTIAL_PREFIX.length + 10);
    return {
      mode: "SYNTHETIC",
      scope: "STATELESS_SANDBOX",
      notice: SANDBOX_NOTICE,
      workspace: { ...payload.workspace },
      agent: { ...payload.agent, status: "ACTIVE" },
      mandate: publicMandate(payload),
      credential: { apiKey, keyPrefix, issuedAt, expiresAt },
      firstRequest: {
        ...input.firstRequest,
        amount: { ...input.firstRequest.amount },
        vendor: { ...input.firstRequest.vendor, id: firstVendorId }
      }
    };
  }

  authorize(apiKey: string | undefined, request: LabEvaluateRequest): SandboxEvaluationResult {
    const payload = this.open(apiKey);
    const now = this.clock();
    const evaluatedAt = now.toISOString();
    const authorizationId = createId("auth");
    const result = evaluatePolicy(this.policyInput(payload, request, evaluatedAt));
    const events: LabEvidenceEvent[] = [
      makeEvent(
        1,
        "REQUEST_RECEIVED",
        payload.agent.name,
        evaluatedAt,
        `${request.capability} · $${request.amount.value} → ${request.vendor.name ?? request.vendor.id}`
      ),
      makeEvent(2, "POLICY_EVALUATED", "CAPYN policy engine", evaluatedAt, result.decision)
    ];
    let outcome: SandboxEvaluationResult["outcome"];
    if (result.decision === "ALLOW") {
      events.push(
        makeEvent(
          3,
          "EXECUTION_SIMULATED",
          "synthetic executor",
          evaluatedAt,
          "Allowed action reached the sandbox execution boundary"
        )
      );
      outcome = "SIMULATED_EXECUTION";
    } else if (result.decision === "REQUIRE_APPROVAL") {
      events.push(
        makeEvent(
          3,
          "APPROVAL_OPENED",
          "CAPYN policy engine",
          evaluatedAt,
          "Request stopped at the configured human checkpoint"
        )
      );
      outcome = "HUMAN_CHECKPOINT";
    } else {
      events.push(
        makeEvent(3, "REQUEST_STOPPED", "CAPYN policy engine", evaluatedAt, "Denied before execution")
      );
      outcome = "STOPPED";
    }

    const keyPrefix = apiKey!.slice(0, CREDENTIAL_PREFIX.length + 10);
    return {
      mode: "SYNTHETIC",
      scope: "STATELESS_SANDBOX",
      notice: SANDBOX_NOTICE,
      authorizationId,
      evaluatedAt,
      workspace: { ...payload.workspace },
      agent: { ...payload.agent, status: "ACTIVE" },
      mandate: publicMandate(payload),
      credential: { keyPrefix, expiresAt: payload.expiresAt },
      request: { ...request, amount: { ...request.amount }, vendor: { ...request.vendor } },
      decision: result.decision,
      reasonCodes: result.reasonCodes,
      reasons: describeReasons(result.reasonCodes),
      trace: result.trace,
      outcome,
      evidence: evidence(authorizationId, request, events)
    };
  }

  inspect(apiKey: string | undefined): SandboxCredentialClaim {
    return structuredClone(this.open(apiKey));
  }

  private policyInput(
    payload: CredentialPayload,
    request: LabEvaluateRequest,
    now: string
  ): PolicyEvaluationInput {
    return {
      now,
      agent: { id: payload.agent.id, status: "ACTIVE" },
      activeMandateCount: 1,
      mandate: {
        id: payload.mandate.id,
        name: payload.mandate.name,
        version: 1,
        status: "ACTIVE",
        validFrom: payload.issuedAt,
        validUntil: payload.expiresAt,
        capabilities: [...payload.mandate.capabilities],
        policy: {
          currency: "USD",
          allowedVendorIds: payload.mandate.allowedVendors.map((vendor) => vendor.id),
          perTransactionLimitMinor: moneyToMinorUnits(payload.mandate.limits.perTransaction, "USD"),
          dailyLimitMinor: moneyToMinorUnits(payload.mandate.limits.daily, "USD"),
          monthlyLimitMinor: moneyToMinorUnits(payload.mandate.limits.monthly, "USD"),
          approvalThresholdMinor: moneyToMinorUnits(payload.mandate.limits.approvalAbove, "USD")
        }
      },
      request: {
        capability: request.capability,
        amountMinor: moneyToMinorUnits(request.amount.value, request.amount.currency),
        currency: request.amount.currency,
        vendor: { id: request.vendor.id.toLowerCase(), name: request.vendor.name ?? null },
        metadata: { purpose: request.purpose }
      },
      spend: { dailyMinor: "0", monthlyMinor: "0" },
      approvalAlreadyGranted: false
    };
  }

  private seal(payload: CredentialPayload): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(CREDENTIAL_AAD);
    const encrypted = Buffer.concat([
      cipher.update(canonicalJson(payload), "utf8"),
      cipher.final()
    ]);
    const tag = cipher.getAuthTag();
    const token = Buffer.concat([Buffer.from([CREDENTIAL_VERSION]), iv, tag, encrypted]).toString("base64url");
    return CREDENTIAL_PREFIX + token;
  }

  private open(apiKey: string | undefined): CredentialPayload {
    if (!apiKey || !apiKey.startsWith(CREDENTIAL_PREFIX)) {
      throw new AuthenticationError("A valid CAPYN sandbox credential is required");
    }
    const token = apiKey.slice(CREDENTIAL_PREFIX.length);
    if (!token || token.length > 6_000 || !TOKEN_PATTERN.test(token)) {
      throw new AuthenticationError("A valid CAPYN sandbox credential is required");
    }
    try {
      const sealed = Buffer.from(token, "base64url");
      if (sealed.toString("base64url") !== token) throw new Error("non-canonical envelope");
      if (sealed.length < 30 || sealed[0] !== CREDENTIAL_VERSION) throw new Error("invalid envelope");
      const iv = sealed.subarray(1, 13);
      const tag = sealed.subarray(13, 29);
      const encrypted = sealed.subarray(29);
      const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
      decipher.setAAD(CREDENTIAL_AAD);
      decipher.setAuthTag(tag);
      const decoded = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
      const parsed = credentialPayloadSchema.parse(JSON.parse(decoded));
      if (Date.parse(parsed.expiresAt) <= this.clock().getTime()) {
        throw new GoneError(
          "SANDBOX_CREDENTIAL_EXPIRED",
          "This sandbox credential expired; commission a fresh session"
        );
      }
      return parsed;
    } catch (error) {
      if (error instanceof GoneError) throw error;
      throw new AuthenticationError("A valid CAPYN sandbox credential is required");
    }
  }
}
