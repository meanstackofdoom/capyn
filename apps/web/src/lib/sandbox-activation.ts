import type { LabEvaluateRequest, SandboxActivateRequest } from "@capyn/types";

export const sandboxCapabilities = [
  { id: "spend.compute", label: "Compute spend", note: "Inference, GPU and hosted compute" },
  { id: "spend.api", label: "API spend", note: "Metered model and data APIs" },
  { id: "spend.software", label: "Software spend", note: "Seats, tools and subscriptions" },
  { id: "transfer.wallet", label: "Wallet transfer", note: "Controlled treasury movement" }
] as const;

export type SandboxStage = "workspace" | "agent" | "mandate" | "credential" | "decision" | "proof";
export type SandboxEditableStage = Extract<SandboxStage, "workspace" | "agent" | "mandate">;

export interface SandboxActivationDraft {
  organisationName: string;
  agentName: string;
  agentSlug: string;
  mandateName: string;
  capability: string;
  vendorName: string;
  vendorId: string;
  approvalAbove: string;
  perTransaction: string;
  daily: string;
  monthly: string;
  firstAmount: string;
  purpose: string;
}

export type SandboxDraftField = keyof SandboxActivationDraft;
export type SandboxDraftErrors = Partial<Record<SandboxDraftField, string>>;

const moneyPattern = /^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const vendorPattern = /^[a-z0-9][a-z0-9_-]*$/i;
const capabilityPattern = /^[a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]*)+$/;

export function createSandboxDraft(): SandboxActivationDraft {
  return {
    organisationName: "Northstar Systems",
    agentName: "Nightly evaluation agent",
    agentSlug: "nightly-evaluation-agent",
    mandateName: "Nightly evaluation authority",
    capability: "spend.compute",
    vendorName: "OpenAI",
    vendorId: "openai",
    approvalAbove: "100.00",
    perTransaction: "150.00",
    daily: "200.00",
    monthly: "2000.00",
    firstAmount: "18.00",
    purpose: "Inference capacity for a customer workflow"
  };
}

export function slugifySandboxName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function parseMoney(value: string): number | null {
  if (!moneyPattern.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function validateSandboxDraft(draft: SandboxActivationDraft): SandboxDraftErrors {
  const errors: SandboxDraftErrors = {};
  if (draft.organisationName.trim().length < 2) errors.organisationName = "Use at least two characters.";
  if (draft.agentName.trim().length < 2) errors.agentName = "Name the agent that will hold this authority.";
  if (draft.agentSlug.length < 2 || !slugPattern.test(draft.agentSlug)) errors.agentSlug = "Use a lowercase slug such as nightly-evaluation-agent.";
  if (draft.mandateName.trim().length < 2) errors.mandateName = "Name this authority boundary.";
  if (!capabilityPattern.test(draft.capability)) errors.capability = "Use a namespaced capability such as spend.compute.";
  if (draft.vendorName.trim().length < 1) errors.vendorName = "Name the approved vendor.";
  if (!vendorPattern.test(draft.vendorId)) errors.vendorId = "Use a stable vendor ID such as openai.";
  if (draft.purpose.trim().length < 3) errors.purpose = "Describe the exact first action.";

  const moneyFields = ["approvalAbove", "perTransaction", "daily", "monthly", "firstAmount"] as const;
  const parsed = {} as Record<(typeof moneyFields)[number], number | null>;
  for (const field of moneyFields) {
    parsed[field] = parseMoney(draft[field]);
    if (parsed[field] === null) errors[field] = "Enter a positive USD amount with at most two decimals.";
  }
  if (parsed.approvalAbove !== null && parsed.perTransaction !== null && parsed.approvalAbove >= parsed.perTransaction) {
    errors.approvalAbove = "Set the human line below the hard ceiling so review remains reachable.";
  }
  if (parsed.perTransaction !== null && parsed.daily !== null && parsed.perTransaction > parsed.daily) {
    errors.daily = "The daily limit must cover at least one maximum action.";
  }
  if (parsed.daily !== null && parsed.monthly !== null && parsed.daily > parsed.monthly) {
    errors.monthly = "The monthly limit must be at least the daily limit.";
  }
  return errors;
}

const stageFields: Record<SandboxEditableStage, SandboxDraftField[]> = {
  workspace: ["organisationName"],
  agent: ["agentName", "agentSlug"],
  mandate: [
    "mandateName",
    "capability",
    "vendorName",
    "vendorId",
    "approvalAbove",
    "perTransaction",
    "daily",
    "monthly",
    "firstAmount",
    "purpose"
  ]
};

export function isSandboxStageValid(draft: SandboxActivationDraft, stage: SandboxEditableStage): boolean {
  const errors = validateSandboxDraft(draft);
  return stageFields[stage].every((field) => !errors[field]);
}

export function createSandboxActivationRequest(draft: SandboxActivationDraft): SandboxActivateRequest {
  return {
    organisation: { name: draft.organisationName.trim() },
    agent: { name: draft.agentName.trim(), slug: draft.agentSlug },
    mandate: {
      name: draft.mandateName.trim(),
      capabilities: [draft.capability],
      allowedVendors: [{ id: draft.vendorId.toLowerCase(), name: draft.vendorName.trim() }],
      limits: {
        approvalAbove: { value: draft.approvalAbove, currency: "USD" },
        perTransaction: { value: draft.perTransaction, currency: "USD" },
        daily: { value: draft.daily, currency: "USD" },
        monthly: { value: draft.monthly, currency: "USD" }
      }
    },
    firstRequest: createSandboxRequest(draft, draft.firstAmount)
  };
}

export function createSandboxRequest(draft: SandboxActivationDraft, amount = draft.firstAmount): LabEvaluateRequest {
  return {
    capability: draft.capability,
    amount: { value: amount, currency: "USD" },
    vendor: { id: draft.vendorId.toLowerCase(), name: draft.vendorName.trim() },
    purpose: draft.purpose.trim()
  };
}

export function createSandboxScenarios(draft: SandboxActivationDraft) {
  const approval = parseMoney(draft.approvalAbove) ?? 100;
  const hard = parseMoney(draft.perTransaction) ?? 150;
  const review = approval < hard ? approval + (hard - approval) / 2 : hard;
  const deny = hard + Math.max(1, hard * 0.1);
  return [
    { id: "inside", label: "Inside boundary", expectation: "ALLOW", amount: draft.firstAmount },
    { id: "human", label: "Cross human line", expectation: "REVIEW", amount: review.toFixed(2) },
    { id: "outside", label: "Cross hard ceiling", expectation: "DENY", amount: deny.toFixed(2) }
  ] as const;
}

export function createSandboxCurl(apiBase: string, request: LabEvaluateRequest): string {
  return `curl -X POST ${apiBase}/v1/sandbox/authorize \\
  -H "Authorization: Bearer $CAPYN_SANDBOX_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(request, null, 2)}'`;
}
