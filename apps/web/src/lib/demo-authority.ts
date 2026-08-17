import type { LabEvaluateRequest } from "@capyn/types";

export const PUBLIC_DEMO_APPROVAL_THRESHOLD = 100;
export const PUBLIC_DEMO_HARD_LIMIT = 150;
export const PUBLIC_DEMO_MAX_AMOUNT = 200;

export const publicLabVendors = [
  { id: "openai", name: "OpenAI", status: "approved" },
  { id: "anthropic", name: "Anthropic", status: "approved" },
  { id: "aws", name: "AWS", status: "approved" },
  { id: "github", name: "GitHub", status: "not approved" }
] as const;

export const publicLabCapabilities = [
  { id: "spend.compute", label: "Spend / compute", status: "granted" },
  { id: "spend.api", label: "Spend / API", status: "granted" },
  { id: "spend.software", label: "Spend / software", status: "not granted" },
  { id: "transfer.wallet", label: "Transfer / wallet", status: "not granted" }
] as const;

export const demoActions = [
  {
    id: "compute",
    label: "Compute",
    capability: "spend.compute",
    granted: true,
    vendor: { id: "openai", name: "OpenAI" },
    purpose: "Inference capacity for a customer workflow",
    initialAmount: 120
  },
  {
    id: "api",
    label: "API",
    capability: "spend.api",
    granted: true,
    vendor: { id: "anthropic", name: "Anthropic" },
    purpose: "Model API usage for an evaluation run",
    initialAmount: 45
  },
  {
    id: "wallet",
    label: "Wallet",
    capability: "transfer.wallet",
    granted: false,
    vendor: { id: "aws", name: "AWS" },
    purpose: "Move funds from the agent treasury",
    initialAmount: 30
  }
] as const;

export type DemoActionId = (typeof demoActions)[number]["id"];
export type DemoVendorState = "approved" | "blocked";
export type DemoRuleState = "pass" | "fail" | "review" | "skipped";
export type DemoTone = "permission" | "review" | "denial";

export type DemoRule = {
  key: "identity" | "capability" | "vendor" | "hard" | "approval";
  label: string;
  value: string;
  state: DemoRuleState;
};

export type DemoEvaluation = {
  decision: "ALLOW" | "DENY" | "REQUIRE_APPROVAL";
  displayWords: readonly string[];
  reason: "ALL_HARD_RULES_PASS" | "APPROVAL_THRESHOLD_EXCEEDED" | "HARD_LIMIT_EXCEEDED" | "VENDOR_NOT_ALLOWED" | "CAPABILITY_NOT_GRANTED";
  tone: DemoTone;
  next: string;
  rules: DemoRule[];
};

export type LabHandoff = {
  request: LabEvaluateRequest;
  source: "homepage" | "shared";
};

const blockedVendor = publicLabVendors.find((vendor) => vendor.id === "github")!;
const allowedCapabilityIds = new Set<string>(publicLabCapabilities.map((capability) => capability.id));
const vendorsById = new Map<string, (typeof publicLabVendors)[number]>(publicLabVendors.map((vendor) => [vendor.id, vendor]));
const amountPattern = /^(?:0|[1-9][0-9]{0,6})(?:\.[0-9]{1,2})?$/;

export function getDemoAction(id: DemoActionId) {
  return demoActions.find((action) => action.id === id) ?? demoActions[0];
}

export function getDemoVendor(actionId: DemoActionId, vendorState: DemoVendorState) {
  const action = getDemoAction(actionId);
  return vendorState === "approved" ? action.vendor : blockedVendor;
}

export function normalizeDemoAmount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(PUBLIC_DEMO_MAX_AMOUNT, Math.max(0, Math.round(value)));
}

export function formatDemoMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

export function createDemoRequest(actionId: DemoActionId, vendorState: DemoVendorState, rawAmount: number): LabEvaluateRequest {
  const action = getDemoAction(actionId);
  const vendor = getDemoVendor(actionId, vendorState);
  const amount = normalizeDemoAmount(rawAmount);
  return {
    capability: action.capability,
    amount: { value: amount.toFixed(2), currency: "USD" },
    vendor: { id: vendor.id, name: vendor.name },
    purpose: action.purpose
  };
}

export function evaluateDemoRequest(actionId: DemoActionId, vendorState: DemoVendorState, rawAmount: number): DemoEvaluation {
  const action = getDemoAction(actionId);
  const vendor = getDemoVendor(actionId, vendorState);
  const amount = normalizeDemoAmount(rawAmount);
  const capabilityFailed = !action.granted;
  const vendorFailed = !capabilityFailed && vendorState === "blocked";
  const hardFailed = !capabilityFailed && !vendorFailed && amount > PUBLIC_DEMO_HARD_LIMIT;
  const approvalRequired = !capabilityFailed && !vendorFailed && !hardFailed && amount > PUBLIC_DEMO_APPROVAL_THRESHOLD;

  const rules: DemoRule[] = [
    { key: "identity", label: "Identity", value: "procurement-agent", state: "pass" },
    {
      key: "capability",
      label: "Capability",
      value: `${action.capability} / ${action.granted ? "granted" : "not granted"}`,
      state: action.granted ? "pass" : "fail"
    },
    {
      key: "vendor",
      label: "Vendor",
      value: capabilityFailed ? "not evaluated" : `${vendor.name} / ${vendorState === "approved" ? "approved" : "blocked"}`,
      state: capabilityFailed ? "skipped" : vendorFailed ? "fail" : "pass"
    },
    {
      key: "hard",
      label: "Hard ceiling",
      value: capabilityFailed || vendorFailed ? "not evaluated" : `${formatDemoMoney(amount)} ≤ ${formatDemoMoney(PUBLIC_DEMO_HARD_LIMIT)}`,
      state: capabilityFailed || vendorFailed ? "skipped" : hardFailed ? "fail" : "pass"
    },
    {
      key: "approval",
      label: "Approval",
      value: capabilityFailed || vendorFailed || hardFailed
        ? "not evaluated"
        : `${formatDemoMoney(amount)} ${approvalRequired ? ">" : "≤"} ${formatDemoMoney(PUBLIC_DEMO_APPROVAL_THRESHOLD)}`,
      state: capabilityFailed || vendorFailed || hardFailed ? "skipped" : approvalRequired ? "review" : "pass"
    }
  ];

  if (capabilityFailed) {
    return {
      decision: "DENY",
      displayWords: ["DENY"],
      reason: "CAPABILITY_NOT_GRANTED",
      tone: "denial",
      next: "The active mandate does not grant this capability. The request stops before vendor or spend checks.",
      rules
    };
  }
  if (vendorFailed) {
    return {
      decision: "DENY",
      displayWords: ["DENY"],
      reason: "VENDOR_NOT_ALLOWED",
      tone: "denial",
      next: "The vendor is outside the active mandate. The request stops before execution.",
      rules
    };
  }
  if (hardFailed) {
    return {
      decision: "DENY",
      displayWords: ["DENY"],
      reason: "HARD_LIMIT_EXCEEDED",
      tone: "denial",
      next: "The amount exceeds the mandate. Human approval cannot override a hard limit.",
      rules
    };
  }
  if (approvalRequired) {
    return {
      decision: "REQUIRE_APPROVAL",
      displayWords: ["REQUIRE", "APPROVAL"],
      reason: "APPROVAL_THRESHOLD_EXCEEDED",
      tone: "review",
      next: "Execution pauses for one request-bound human decision.",
      rules
    };
  }
  return {
    decision: "ALLOW",
    displayWords: ["ALLOW"],
    reason: "ALL_HARD_RULES_PASS",
    tone: "permission",
    next: "Every delegated limit passes. The agent may continue to execution.",
    rules
  };
}

export function serializeLabHandoff(request: LabEvaluateRequest, source: LabHandoff["source"] = "shared"): URLSearchParams {
  const params = new URLSearchParams();
  params.set("capability", request.capability);
  params.set("vendor", request.vendor.id);
  params.set("amount", request.amount.value);
  params.set("purpose", request.purpose);
  params.set("source", source);
  return params;
}

export function createLabHandoffHref(request: LabEvaluateRequest, source: LabHandoff["source"] = "homepage"): string {
  return `/lab?${serializeLabHandoff(request, source).toString()}`;
}

export function parseLabHandoff(input: string | URLSearchParams): LabHandoff | null {
  const params = typeof input === "string" ? new URLSearchParams(input.startsWith("?") ? input.slice(1) : input) : input;
  const capability = params.get("capability")?.trim() ?? "";
  const vendorId = params.get("vendor")?.trim() ?? "";
  const amount = params.get("amount")?.trim() ?? "";
  const purpose = params.get("purpose")?.trim() ?? "";
  const vendor = vendorsById.get(vendorId);

  if (!allowedCapabilityIds.has(capability) || !vendor || !amountPattern.test(amount) || purpose.length < 3 || purpose.length > 160) {
    return null;
  }
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount > 1_000_000) return null;

  return {
    request: {
      capability,
      amount: { value: numericAmount.toFixed(2), currency: "USD" },
      vendor: { id: vendor.id, name: vendor.name },
      purpose
    },
    source: params.get("source") === "homepage" ? "homepage" : "shared"
  };
}
