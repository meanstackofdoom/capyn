import { z } from "zod";

export const CAPYN_VERSION = "0.4.0";

export const CORE_CAPABILITIES = [
  "spend.compute",
  "spend.api",
  "spend.software",
  "transfer.wallet"
] as const;

export const capabilitySchema = z
  .string()
  .min(3)
  .max(100)
  .regex(/^[a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]*)+$/, "Use a namespaced capability such as spend.compute");

export const moneyInputSchema = z
  .object({
    value: z
      .string()
      .regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/, "Use a positive decimal string with at most two decimal places")
      .refine((value) => BigInt(value.replace(".", "")) > 0n, "Amount must be greater than zero"),
    currency: z.literal("USD")
  })
  .strict();

export const vendorSchema = z
  .object({
    id: z.string().trim().min(1).max(100).regex(/^[a-z0-9][a-z0-9_-]*$/i),
    name: z.string().trim().min(1).max(160).optional()
  })
  .strict();

const jsonPrimitiveSchema = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([jsonPrimitiveSchema, z.array(jsonValueSchema), z.record(jsonValueSchema)])
);

export const authorizeRequestSchema = z
  .object({
    capability: capabilitySchema,
    amount: moneyInputSchema,
    vendor: vendorSchema,
    metadata: z.record(jsonValueSchema).optional().default({})
  })
  .strict();

export type AuthorizeRequest = z.infer<typeof authorizeRequestSchema>;

export const labEvaluateRequestSchema = z
  .object({
    capability: capabilitySchema,
    amount: moneyInputSchema,
    vendor: vendorSchema,
    purpose: z.string().trim().min(3).max(160)
  })
  .strict();

export type LabEvaluateRequest = z.infer<typeof labEvaluateRequestSchema>;

export const labApprovalDecisionSchema = z
  .object({
    decision: z.enum(["APPROVE", "REJECT"])
  })
  .strict();

export type LabApprovalDecision = z.infer<typeof labApprovalDecisionSchema>;

export const sandboxActivateRequestSchema = z
  .object({
    organisation: z
      .object({
        name: z.string().trim().min(2).max(120)
      })
      .strict(),
    agent: z
      .object({
        name: z.string().trim().min(2).max(120),
        slug: z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      })
      .strict(),
    mandate: z
      .object({
        name: z.string().trim().min(2).max(120),
        capabilities: z.array(capabilitySchema).min(1).max(8),
        allowedVendors: z.array(vendorSchema).min(1).max(8),
        limits: z
          .object({
            perTransaction: moneyInputSchema,
            daily: moneyInputSchema,
            monthly: moneyInputSchema,
            approvalAbove: moneyInputSchema
          })
          .strict()
      })
      .strict(),
    firstRequest: labEvaluateRequestSchema
  })
  .strict();

export type SandboxActivateRequest = z.infer<typeof sandboxActivateRequestSchema>;

export const productionLaunchRequestSchema = z
  .object({
    organisation: z
      .object({
        slug: z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      })
      .strict(),
    owner: z
      .object({
        name: z.string().trim().min(2).max(160),
        email: z.string().trim().email().max(320)
      })
      .strict(),
    planIntent: z.enum(["DEVELOPER", "TEAM", "BUSINESS"]),
    acknowledgements: z
      .object({
        keyCustody: z.literal(true),
        syntheticExecution: z.literal(true)
      })
      .strict()
  })
  .strict();

export type ProductionLaunchRequest = z.infer<typeof productionLaunchRequestSchema>;

export const DECISIONS = ["ALLOW", "DENY", "REQUIRE_APPROVAL"] as const;
export type Decision = (typeof DECISIONS)[number];

export const REASON_CODES = [
  "AGENT_ACTIVE",
  "AGENT_INACTIVE",
  "ACTIVE_MANDATE_FOUND",
  "NO_ACTIVE_MANDATE",
  "MANDATE_VALID",
  "MANDATE_EXPIRED",
  "MANDATE_NOT_YET_VALID",
  "CAPABILITY_ALLOWED",
  "CAPABILITY_NOT_GRANTED",
  "VENDOR_ALLOWED",
  "VENDOR_NOT_ALLOWED",
  "TRANSACTION_LIMIT_OK",
  "TRANSACTION_LIMIT_EXCEEDED",
  "DAILY_LIMIT_OK",
  "DAILY_LIMIT_EXCEEDED",
  "MONTHLY_LIMIT_OK",
  "MONTHLY_LIMIT_EXCEEDED",
  "APPROVAL_NOT_REQUIRED",
  "APPROVAL_THRESHOLD_EXCEEDED",
  "POLICY_CONFIGURATION_ERROR"
] as const;

export type ReasonCode = (typeof REASON_CODES)[number];

export const REASON_DESCRIPTIONS: Readonly<Record<ReasonCode, string>> = {
  AGENT_ACTIVE: "The requesting agent is active.",
  AGENT_INACTIVE: "The requesting agent is not active.",
  ACTIVE_MANDATE_FOUND: "An active mandate governs this request.",
  NO_ACTIVE_MANDATE: "The agent has no active mandate.",
  MANDATE_VALID: "The mandate is within its validity window.",
  MANDATE_EXPIRED: "The mandate has expired.",
  MANDATE_NOT_YET_VALID: "The mandate is not valid yet.",
  CAPABILITY_ALLOWED: "The mandate grants the requested capability.",
  CAPABILITY_NOT_GRANTED: "The mandate does not grant the requested capability.",
  VENDOR_ALLOWED: "The vendor is approved by the mandate.",
  VENDOR_NOT_ALLOWED: "The vendor is not approved by the mandate.",
  TRANSACTION_LIMIT_OK: "The amount is within the per-transaction limit.",
  TRANSACTION_LIMIT_EXCEEDED: "The amount exceeds the per-transaction limit.",
  DAILY_LIMIT_OK: "The projected spend is within the daily limit.",
  DAILY_LIMIT_EXCEEDED: "The projected spend exceeds the daily limit.",
  MONTHLY_LIMIT_OK: "The projected spend is within the monthly limit.",
  MONTHLY_LIMIT_EXCEEDED: "The projected spend exceeds the monthly limit.",
  APPROVAL_NOT_REQUIRED: "The amount does not require human approval.",
  APPROVAL_THRESHOLD_EXCEEDED: "The amount requires a human approver.",
  POLICY_CONFIGURATION_ERROR: "The policy could not be evaluated safely."
};

export const ruleTraceSchema = z
  .object({
    rule: z.string(),
    result: z.enum(["PASS", "FAIL", "REVIEW"]),
    reasonCode: z.enum(REASON_CODES),
    details: z.record(z.string()).optional()
  })
  .strict();

export type RuleTrace = z.infer<typeof ruleTraceSchema>;

const reasonSchema = z.object({
  code: z.enum(REASON_CODES),
  description: z.string()
});

const authorizationBaseSchema = z.object({
  authorizationId: z.string(),
  reasonCodes: z.array(z.enum(REASON_CODES)),
  reasons: z.array(reasonSchema),
  expiresAt: z.string().datetime().nullable()
});

export const authorizationResultSchema = z.discriminatedUnion("decision", [
  authorizationBaseSchema.extend({ decision: z.literal("ALLOW") }),
  authorizationBaseSchema.extend({ decision: z.literal("DENY") }),
  authorizationBaseSchema.extend({
    decision: z.literal("REQUIRE_APPROVAL"),
    approvalId: z.string()
  })
]);

export type AuthorizationResult = z.infer<typeof authorizationResultSchema>;

export const AGENT_STATUSES = ["ACTIVE", "SUSPENDED", "REVOKED"] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];
export const MANDATE_STATUSES = ["DRAFT", "ACTIVE", "REVOKED", "EXPIRED"] as const;
export type MandateStatus = (typeof MANDATE_STATUSES)[number];
export const USER_ROLES = ["OWNER", "ADMIN", "APPROVER", "VIEWER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const BILLING_PLAN_IDS = ["DEVELOPER", "TEAM", "BUSINESS", "ENTERPRISE", "DESIGN_PARTNER"] as const;
export type BillingPlanId = (typeof BILLING_PLAN_IDS)[number];

export const SUBSCRIPTION_STATUSES = [
  "TRIALING",
  "ACTIVE",
  "PAST_DUE",
  "CANCELED",
  "INCOMPLETE",
  "UNPAID",
  "PAUSED"
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const BILLING_PROVIDER_NAMES = ["INTERNAL", "MANUAL", "STRIPE"] as const;
export type BillingProviderName = (typeof BILLING_PROVIDER_NAMES)[number];

export const BILLABLE_METRICS = [
  "AUTHORIZATION_DECISION",
  "APPROVAL_REQUEST",
  "ACTIVE_AGENT",
  "AUDIT_EVENT",
  "INTEGRATION_CONNECTION"
] as const;
export type BillableMetric = (typeof BILLABLE_METRICS)[number];

export interface BillingUsageLine {
  metric: BillableMetric;
  used: number;
  included: number | null;
  overage: number;
  unitSize: number | null;
  unitPriceCents: number | null;
  projectedChargeCents: number;
  enforcement: "HARD_LIMIT" | "METERED" | "INCLUDED" | "CONTRACT";
}

export interface BillingOverview {
  planId: BillingPlanId;
  planName: string;
  subscriptionStatus: SubscriptionStatus;
  provider: BillingProviderName;
  currency: "USD";
  basePriceCents: number | null;
  priceRangeCents: readonly [number, number] | null;
  estimatedMonthlyCents: number | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  auditRetentionDays: number | null;
  approvalWorkflows: string;
  reliability: string;
  compliance: string;
  usage: BillingUsageLine[];
  checkoutAvailable: boolean;
  customerPortalAvailable: boolean;
}

export const billingCheckoutSchema = z
  .object({ planId: z.enum(["TEAM", "BUSINESS"]) })
  .strict();
export type BillingCheckoutRequest = z.infer<typeof billingCheckoutSchema>;

export const AUTHORIZATION_STATES = [
  "REQUESTED",
  "ALLOWED",
  "DENIED",
  "AWAITING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "EXECUTING",
  "EXECUTED",
  "FAILED",
  "EXPIRED"
] as const;
export type AuthorizationState = (typeof AUTHORIZATION_STATES)[number];

export interface NormalizedAuthorizationRequest {
  capability: string;
  amountMinor: string;
  currency: "USD";
  vendor: { id: string; name: string | null };
  metadata: Record<string, JsonValue>;
}

export interface SpendingPolicyContext {
  currency: "USD";
  allowedVendorIds: string[];
  perTransactionLimitMinor: string;
  dailyLimitMinor: string;
  monthlyLimitMinor: string;
  approvalThresholdMinor: string;
}

export interface MandatePolicyContext {
  id: string;
  name: string;
  version: number;
  status: MandateStatus;
  validFrom: string;
  validUntil: string;
  capabilities: string[];
  policy: SpendingPolicyContext | null;
}

export interface PolicyEvaluationInput {
  now: string;
  agent: { id: string; status: AgentStatus };
  activeMandateCount: number;
  mandate: MandatePolicyContext | null;
  request: NormalizedAuthorizationRequest;
  spend: {
    dailyMinor: string;
    monthlyMinor: string;
  };
  approvalAlreadyGranted: boolean;
}

export interface PolicyEvaluation {
  decision: Decision;
  reasonCodes: ReasonCode[];
  trace: RuleTrace[];
}

export interface LabEvidenceEvent {
  sequence: number;
  type:
    | "REQUEST_RECEIVED"
    | "POLICY_EVALUATED"
    | "APPROVAL_OPENED"
    | "APPROVAL_RECORDED"
    | "REQUEST_STOPPED"
    | "EXECUTION_SIMULATED";
  actor: string;
  timestamp: string;
  detail: string;
}

export interface LabEvidence {
  receiptId: string;
  digest: string;
  events: LabEvidenceEvent[];
}

export interface LabMandateView {
  id: "lab_mandate_procurement_v3";
  name: "Procurement / bounded compute";
  version: 3;
  capabilities: string[];
  allowedVendors: Array<{ id: string; name: string }>;
  limits: {
    perTransaction: string;
    daily: string;
    monthly: string;
    approvalAbove: string;
  };
  observedSpend: {
    today: string;
    month: string;
  };
}

export interface LabEvaluationResult {
  mode: "SYNTHETIC";
  notice: string;
  authorizationId: string;
  evaluatedAt: string;
  agent: { id: "lab_agent_procurement"; name: "procurement-agent"; status: "ACTIVE" };
  mandate: LabMandateView;
  request: LabEvaluateRequest;
  decision: Decision;
  reasonCodes: ReasonCode[];
  reasons: Array<{ code: ReasonCode; description: string }>;
  trace: RuleTrace[];
  outcome: "SIMULATED_EXECUTION" | "AWAITING_HUMAN" | "STOPPED";
  approval: { id: string; expiresAt: string } | null;
  evidence: LabEvidence;
}

export interface LabResolutionResult {
  mode: "SYNTHETIC";
  notice: string;
  authorizationId: string;
  approvalId: string;
  resolvedAt: string;
  request: LabEvaluateRequest;
  resolution: "APPROVED" | "REJECTED";
  policyDecision: "ALLOW" | "REQUIRE_APPROVAL";
  outcome: "SIMULATED_EXECUTION" | "STOPPED";
  reasonCodes: ReasonCode[];
  reasons: Array<{ code: ReasonCode; description: string }>;
  trace: RuleTrace[];
  evidence: LabEvidence;
}

export interface SandboxMandateView {
  id: string;
  name: string;
  version: 1;
  capabilities: string[];
  allowedVendors: Array<{ id: string; name: string }>;
  limits: {
    perTransaction: string;
    daily: string;
    monthly: string;
    approvalAbove: string;
  };
  observedSpend: {
    today: "0.00";
    month: "0.00";
  };
  validUntil: string;
}

export interface SandboxActivationResult {
  mode: "SYNTHETIC";
  scope: "STATELESS_SANDBOX";
  notice: string;
  workspace: { id: string; name: string };
  agent: { id: string; name: string; slug: string; status: "ACTIVE" };
  mandate: SandboxMandateView;
  credential: {
    apiKey: string;
    keyPrefix: string;
    issuedAt: string;
    expiresAt: string;
  };
  firstRequest: LabEvaluateRequest;
}

export interface SandboxEvaluationResult {
  mode: "SYNTHETIC";
  scope: "STATELESS_SANDBOX";
  notice: string;
  authorizationId: string;
  evaluatedAt: string;
  workspace: { id: string; name: string };
  agent: { id: string; name: string; slug: string; status: "ACTIVE" };
  mandate: SandboxMandateView;
  credential: { keyPrefix: string; expiresAt: string };
  request: LabEvaluateRequest;
  decision: Decision;
  reasonCodes: ReasonCode[];
  reasons: Array<{ code: ReasonCode; description: string }>;
  trace: RuleTrace[];
  outcome: "SIMULATED_EXECUTION" | "HUMAN_CHECKPOINT" | "STOPPED";
  evidence: LabEvidence;
}

export interface ProductionLaunchResult {
  mode: "HOSTED_ALPHA";
  scope: "DURABLE_WORKSPACE";
  replayed: boolean;
  createdAt: string;
  workspace: { id: string; name: string; slug: string; persistence: "POSTGRESQL" | "VOLUME_JOURNAL" | "PROCESS_MEMORY" };
  owner: { id: string; name: string; email: string; role: "OWNER" };
  agent: { id: string; name: string; slug: string; status: "ACTIVE" };
  mandate: {
    id: string;
    name: string;
    version: number;
    validUntil: string;
    capabilities: string[];
  };
  credentials: {
    owner: {
      id: string;
      apiKey: string;
      keyPrefix: string;
      scope: "OWNER_CONTROL_PLANE";
    };
    agent: {
      id: string;
      apiKey: string;
      keyPrefix: string;
      scope: "AGENT_AUTHORIZATION";
    };
  };
  billing: {
    planIntent: "DEVELOPER" | "TEAM" | "BUSINESS";
    activePlan: "DEVELOPER";
    checkoutAvailable: boolean;
    checkoutUrl: string | null;
    note: string;
  };
  handoff: {
    dashboardPath: "/dashboard";
    importedFrom: "STATELESS_SANDBOX";
    sandboxCredentialConsumed: true;
  };
}

export interface AgentPrincipal {
  type: "AGENT";
  organisationId: string;
  agentId: string;
  credentialId: string;
}

export interface UserPrincipal {
  type: "USER";
  organisationId: string;
  userId: string;
  role: UserRole;
}

export type Principal = AgentPrincipal | UserPrincipal;

export interface AuthorizationView {
  id: string;
  organisationId: string;
  agentId: string;
  agentName: string;
  mandateId: string | null;
  capability: string;
  amount: { value: string; currency: "USD" };
  vendor: { id: string; name: string | null };
  metadata: Record<string, JsonValue>;
  decision: Decision;
  state: AuthorizationState;
  reasonCodes: ReasonCode[];
  trace: RuleTrace[];
  approvalId: string | null;
  createdAt: string;
  expiresAt: string | null;
}

export interface ApprovalView {
  id: string;
  authorizationId: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  agentId: string;
  agentName: string;
  capability: string;
  vendor: { id: string; name: string | null };
  amount: { value: string; currency: "USD" };
  purpose: string | null;
  mandateName: string | null;
  triggeredBy: ReasonCode;
  requestedAt: string;
  decidedAt: string | null;
  comment: string | null;
}

export interface AgentCredentialView {
  id: string;
  keyPrefix: string;
  status: "ACTIVE" | "REVOKED";
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  rotatedFromId: string | null;
}

export interface AgentView {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: AgentStatus;
  keyPrefix: string | null;
  credentials: AgentCredentialView[];
  mandate: {
    id: string;
    name: string;
    version: number;
    validUntil: string;
    capabilities: string[];
  } | null;
  spendToday: string;
  spendMonth: string;
  createdAt: string;
}

export interface AuditEventView {
  id: string;
  actorType: "USER" | "AGENT" | "SYSTEM";
  actorId: string | null;
  eventType: string;
  entityType: string;
  entityId: string;
  timestamp: string;
  metadata: Record<string, JsonValue>;
}

export interface DashboardSnapshot {
  organisation: { id: string; name: string; slug: string };
  operator?: { id: string; name: string; email: string; role: UserRole };
  stats: {
    activeAgents: number;
    activeMandates: number;
    spendToday: string;
    approvalsWaiting: number;
    allowedRequests: number;
    deniedRequests: number;
  };
  agents: AgentView[];
  authorizations: AuthorizationView[];
  approvals: ApprovalView[];
  auditEvents: AuditEventView[];
}

export const approvalDecisionSchema = z
  .object({
    decision: z.enum(["APPROVE", "REJECT"]),
    comment: z.string().trim().max(500).optional()
  })
  .strict();

export type ApprovalDecisionRequest = z.infer<typeof approvalDecisionSchema>;

export const mandateCreateSchema = z
  .object({
    agentId: z.string().min(1),
    name: z.string().trim().min(1).max(120),
    capabilities: z.array(capabilitySchema).min(1).max(50),
    allowedVendors: z.array(vendorSchema).min(1).max(100),
    limits: z
      .object({
        perTransaction: moneyInputSchema,
        daily: moneyInputSchema,
        monthly: moneyInputSchema,
        approvalAbove: moneyInputSchema
      })
      .strict(),
    validUntil: z.string().datetime()
  })
  .strict();

export type MandateCreateRequest = z.infer<typeof mandateCreateSchema>;

export interface ExecutionResultView {
  executionId: string;
  authorizationId: string;
  status: "EXECUTED" | "FAILED";
  provider: string;
  reference: string | null;
  executedAt: string | null;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: Array<{ path: string; message: string }>;
  };
}

export function moneyToMinorUnits(value: string, currency: "USD"): string {
  if (currency !== "USD" || !/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(value)) {
    throw new Error("Unsupported or invalid money value");
  }
  const [whole = "0", fraction = ""] = value.split(".");
  return (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"))).toString();
}

export function minorUnitsToMoney(value: string | bigint, currency: "USD" = "USD"): string {
  if (currency !== "USD") throw new Error("Unsupported currency");
  const minor = typeof value === "bigint" ? value : BigInt(value);
  const sign = minor < 0n ? "-" : "";
  const absolute = minor < 0n ? -minor : minor;
  return `${sign}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, "0")}`;
}

export function describeReasons(codes: ReasonCode[]): Array<{ code: ReasonCode; description: string }> {
  return codes.map((code) => ({ code, description: REASON_DESCRIPTIONS[code] }));
}
