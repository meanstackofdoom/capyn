import { CORE_CAPABILITIES } from "@capyn/types";
import {
  createLabHandoffHref,
  publicLabVendors
} from "./demo-authority";

export const MANDATE_STUDIO_STORAGE_KEY = "capyn:mandate-studio:v1";
export const MANDATE_STUDIO_VERSION = 1 as const;

export const studioCapabilities = [
  { id: "spend.compute", label: "Compute spend", note: "Inference, GPU and hosted compute capacity", sensitive: false },
  { id: "spend.api", label: "API spend", note: "Metered model, data and infrastructure APIs", sensitive: false },
  { id: "spend.software", label: "Software spend", note: "Subscriptions, seats and one-off tools", sensitive: false },
  { id: "transfer.wallet", label: "Wallet transfer", note: "Movement of funds between controlled accounts", sensitive: true }
] as const;

export type StudioCapability = (typeof CORE_CAPABILITIES)[number];
export type StudioStage = "action" | "boundary" | "limits" | "integrate";
export type StudioStatus = "UNBOUND" | "DRAFT" | "TESTABLE";
export type StudioValidityDays = 30 | 90 | 365;

export interface StudioVendor {
  id: string;
  name: string;
}

export interface StudioLimits {
  perTransaction: string;
  daily: string;
  monthly: string;
  approvalAbove: string;
}

export interface MandateStudioDraft {
  version: typeof MANDATE_STUDIO_VERSION;
  presetId: StudioPresetId;
  agentName: string;
  mandateName: string;
  purpose: string;
  capabilities: StudioCapability[];
  vendors: StudioVendor[];
  limits: StudioLimits;
  validityDays: StudioValidityDays;
}

export interface StoredMandateStudioDraft {
  schemaVersion: typeof MANDATE_STUDIO_VERSION;
  savedAt: string;
  draft: MandateStudioDraft;
}

export type StudioField =
  | "agentName"
  | "mandateName"
  | "purpose"
  | "capabilities"
  | "vendors"
  | keyof StudioLimits
  | "validityDays";

export type StudioErrors = Partial<Record<StudioField, string>>;

export const studioStages = [
  { id: "action", label: "Name the action", short: "Action" },
  { id: "boundary", label: "Draw the boundary", short: "Boundary" },
  { id: "limits", label: "Set the human line", short: "Limits" },
  { id: "integrate", label: "Carry it into code", short: "Integrate" }
] as const;

export const studioPresets = [
  {
    id: "inference",
    label: "Inference capacity",
    note: "Compute and model APIs with a human line before larger purchases",
    draft: {
      agentName: "procurement-agent",
      mandateName: "Inference procurement",
      purpose: "Purchase inference capacity for customer workflows",
      capabilities: ["spend.compute", "spend.api"],
      vendors: [
        { id: "openai", name: "OpenAI" },
        { id: "anthropic", name: "Anthropic" },
        { id: "aws", name: "AWS" }
      ],
      limits: { perTransaction: "150.00", daily: "200.00", monthly: "2000.00", approvalAbove: "100.00" },
      validityDays: 90
    }
  },
  {
    id: "software",
    label: "Software procurement",
    note: "Approved tools and subscriptions with a deliberately low approval line",
    draft: {
      agentName: "operations-agent",
      mandateName: "Approved software purchasing",
      purpose: "Purchase approved software for the operations team",
      capabilities: ["spend.software"],
      vendors: [
        { id: "github", name: "GitHub" },
        { id: "linear", name: "Linear" },
        { id: "notion", name: "Notion" }
      ],
      limits: { perTransaction: "100.00", daily: "250.00", monthly: "1200.00", approvalAbove: "50.00" },
      validityDays: 90
    }
  },
  {
    id: "treasury",
    label: "Treasury movement",
    note: "Sensitive wallet transfers that always begin at a human checkpoint",
    draft: {
      agentName: "treasury-agent",
      mandateName: "Controlled treasury transfer",
      purpose: "Move funds between controlled operating accounts",
      capabilities: ["transfer.wallet"],
      vendors: [{ id: "aws", name: "AWS" }],
      limits: { perTransaction: "500.00", daily: "1000.00", monthly: "5000.00", approvalAbove: "1.00" },
      validityDays: 30
    }
  }
] as const;

export type StudioPresetId = (typeof studioPresets)[number]["id"];

const moneyPattern = /^(?:0|[1-9][0-9]{0,8})(?:\.[0-9]{1,2})?$/;
const agentPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const vendorIdPattern = /^[a-z0-9][a-z0-9_-]{0,99}$/;
const validCapabilities = new Set<string>(CORE_CAPABILITIES);
const validPresetIds = new Set<string>(studioPresets.map((preset) => preset.id));
const validValidityDays = new Set<number>([30, 90, 365]);

function clonePreset(id: StudioPresetId): MandateStudioDraft {
  const preset = studioPresets.find((item) => item.id === id) ?? studioPresets[0];
  return {
    version: MANDATE_STUDIO_VERSION,
    presetId: preset.id,
    agentName: preset.draft.agentName,
    mandateName: preset.draft.mandateName,
    purpose: preset.draft.purpose,
    capabilities: [...preset.draft.capabilities],
    vendors: preset.draft.vendors.map((vendor) => ({ ...vendor })),
    limits: { ...preset.draft.limits },
    validityDays: preset.draft.validityDays
  };
}

export function createMandateStudioDraft(id: StudioPresetId = "inference"): MandateStudioDraft {
  return clonePreset(id);
}

export function createStudioVendor(name: string): StudioVendor | null {
  const cleanName = name.trim().replace(/\s+/g, " ").slice(0, 160);
  if (!cleanName) return null;
  const id = cleanName
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  if (!vendorIdPattern.test(id)) return null;
  return { id, name: cleanName };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length <= maxLength;
}

function parseDraft(value: unknown): MandateStudioDraft | null {
  if (!isRecord(value) || value.version !== MANDATE_STUDIO_VERSION) return null;
  if (!validPresetIds.has(String(value.presetId))) return null;
  if (!isBoundedString(value.agentName, 80) || !isBoundedString(value.mandateName, 120) || !isBoundedString(value.purpose, 160)) return null;
  if (!Array.isArray(value.capabilities) || value.capabilities.length > CORE_CAPABILITIES.length) return null;
  const capabilities = value.capabilities.filter((item): item is StudioCapability => typeof item === "string" && validCapabilities.has(item));
  if (capabilities.length !== value.capabilities.length || new Set(capabilities).size !== capabilities.length) return null;
  if (!Array.isArray(value.vendors) || value.vendors.length > 10) return null;
  const vendors: StudioVendor[] = [];
  for (const item of value.vendors) {
    if (!isRecord(item) || !isBoundedString(item.id, 100) || !isBoundedString(item.name, 160) || !vendorIdPattern.test(item.id)) return null;
    vendors.push({ id: item.id, name: item.name });
  }
  if (!isRecord(value.limits)) return null;
  const limitKeys: Array<keyof StudioLimits> = ["perTransaction", "daily", "monthly", "approvalAbove"];
  const limits = {} as StudioLimits;
  for (const key of limitKeys) {
    const input = value.limits[key];
    if (!isBoundedString(input, 16)) return null;
    limits[key] = input;
  }
  if (typeof value.validityDays !== "number" || !validValidityDays.has(value.validityDays)) return null;
  return {
    version: MANDATE_STUDIO_VERSION,
    presetId: value.presetId as StudioPresetId,
    agentName: value.agentName,
    mandateName: value.mandateName,
    purpose: value.purpose,
    capabilities,
    vendors,
    limits,
    validityDays: value.validityDays as StudioValidityDays
  };
}

export function serializeStoredMandateDraft(draft: MandateStudioDraft, savedAt = new Date().toISOString()): string {
  return JSON.stringify({ schemaVersion: MANDATE_STUDIO_VERSION, savedAt, draft } satisfies StoredMandateStudioDraft);
}

export function parseStoredMandateDraft(input: string): StoredMandateStudioDraft | null {
  try {
    const value: unknown = JSON.parse(input);
    if (!isRecord(value) || value.schemaVersion !== MANDATE_STUDIO_VERSION || typeof value.savedAt !== "string") return null;
    const savedAt = new Date(value.savedAt);
    if (Number.isNaN(savedAt.getTime())) return null;
    const draft = parseDraft(value.draft);
    return draft ? { schemaVersion: MANDATE_STUDIO_VERSION, savedAt: savedAt.toISOString(), draft } : null;
  } catch {
    return null;
  }
}

function parseMoney(value: string): number | null {
  if (!moneyPattern.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function validateMandateStudioDraft(draft: MandateStudioDraft): StudioErrors {
  const errors: StudioErrors = {};
  if (!agentPattern.test(draft.agentName) || draft.agentName.length < 3) errors.agentName = "Use a lowercase agent slug such as procurement-agent.";
  if (draft.mandateName.trim().length < 3) errors.mandateName = "Name the authority this mandate represents.";
  if (draft.purpose.trim().length < 3) errors.purpose = "Describe the exact consequential action.";
  if (draft.capabilities.length === 0) errors.capabilities = "Grant at least one capability.";
  if (draft.vendors.length === 0) errors.vendors = "Approve at least one vendor.";
  if (new Set(draft.vendors.map((vendor) => vendor.id)).size !== draft.vendors.length) errors.vendors = "Each approved vendor must be unique.";

  const parsed: Partial<Record<keyof StudioLimits, number>> = {};
  const moneyLabels: Record<keyof StudioLimits, string> = {
    perTransaction: "Enter a valid hard per-action limit.",
    daily: "Enter a valid daily limit.",
    monthly: "Enter a valid monthly limit.",
    approvalAbove: "Enter a valid human-approval threshold."
  };
  (Object.keys(moneyLabels) as Array<keyof StudioLimits>).forEach((key) => {
    const amount = parseMoney(draft.limits[key]);
    if (amount === null) errors[key] = moneyLabels[key];
    else parsed[key] = amount;
  });

  if (parsed.approvalAbove !== undefined && parsed.perTransaction !== undefined && parsed.approvalAbove > parsed.perTransaction) {
    errors.approvalAbove = "The human line cannot exceed the hard per-action limit.";
  }
  if (parsed.perTransaction !== undefined && parsed.daily !== undefined && parsed.perTransaction > parsed.daily) {
    errors.daily = "The daily limit must cover at least one maximum action.";
  }
  if (parsed.daily !== undefined && parsed.monthly !== undefined && parsed.daily > parsed.monthly) {
    errors.monthly = "The monthly limit must be greater than or equal to the daily limit.";
  }
  if (!validValidityDays.has(draft.validityDays)) errors.validityDays = "Choose a supported validity window.";
  return errors;
}

const stageFields: Record<StudioStage, StudioField[]> = {
  action: ["agentName", "mandateName", "purpose"],
  boundary: ["capabilities", "vendors"],
  limits: ["perTransaction", "daily", "monthly", "approvalAbove", "validityDays"],
  integrate: []
};

export function isStudioStageValid(draft: MandateStudioDraft, stage: StudioStage): boolean {
  const errors = validateMandateStudioDraft(draft);
  if (stage === "integrate") return Object.keys(errors).length === 0;
  return stageFields[stage].every((field) => !errors[field]);
}

export function getMandateStudioStatus(draft: MandateStudioDraft): { status: StudioStatus; completed: number; total: number } {
  const actionReady = isStudioStageValid(draft, "action");
  const boundaryReady = isStudioStageValid(draft, "boundary");
  const limitsReady = isStudioStageValid(draft, "limits");
  const completed = [actionReady, boundaryReady, limitsReady].filter(Boolean).length;
  if (!actionReady) return { status: "UNBOUND", completed, total: 3 };
  if (actionReady && boundaryReady && limitsReady) return { status: "TESTABLE", completed, total: 3 };
  return { status: "DRAFT", completed, total: 3 };
}

export function createMandateConfig(draft: MandateStudioDraft) {
  return {
    mode: "DRAFT_ONLY",
    schemaVersion: MANDATE_STUDIO_VERSION,
    agent: {
      proposedSlug: draft.agentName,
      displayName: draft.agentName.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ")
    },
    mandate: {
      name: draft.mandateName.trim(),
      status: "DRAFT",
      capabilities: draft.capabilities,
      allowedVendors: draft.vendors,
      limits: {
        perTransaction: { value: draft.limits.perTransaction, currency: "USD" },
        daily: { value: draft.limits.daily, currency: "USD" },
        monthly: { value: draft.limits.monthly, currency: "USD" },
        approvalAbove: { value: draft.limits.approvalAbove, currency: "USD" }
      },
      validityDays: draft.validityDays
    },
    exampleIntent: {
      capability: draft.capabilities[0] ?? "spend.compute",
      vendor: draft.vendors[0] ?? { id: "openai", name: "OpenAI" },
      purpose: draft.purpose.trim()
    }
  } as const;
}

export function createStudioTypeScript(draft: MandateStudioDraft): string {
  const capability = draft.capabilities[0] ?? "spend.compute";
  const vendor = draft.vendors[0] ?? { id: "openai", name: "OpenAI" };
  const approval = parseMoney(draft.limits.approvalAbove) ?? 100;
  const perTransaction = parseMoney(draft.limits.perTransaction) ?? 150;
  const amount = Math.max(0.01, Math.min(perTransaction, approval * 0.5)).toFixed(2);
  return `import { Capyn } from "@capyn/sdk";

const capyn = new Capyn({
  apiKey: process.env.CAPYN_API_KEY!
});

const result = await capyn.authorize({
  capability: ${JSON.stringify(capability)},
  amount: { value: ${JSON.stringify(amount)}, currency: "USD" },
  vendor: { id: ${JSON.stringify(vendor.id)}, name: ${JSON.stringify(vendor.name)} },
  metadata: { purpose: ${JSON.stringify(draft.purpose.trim())} }
});

if (result.decision === "ALLOW") {
  // Execute this exact action through your chosen rail.
}`;
}

export function createStudioDecisionSamples(draft: MandateStudioDraft) {
  const approval = parseMoney(draft.limits.approvalAbove) ?? 100;
  const hard = parseMoney(draft.limits.perTransaction) ?? 150;
  const allow = Math.max(0.01, Math.min(approval, approval * 0.5));
  const review = approval < hard ? approval + (hard - approval) / 2 : hard;
  const deny = hard + Math.max(1, hard * 0.1);
  return [
    { decision: "ALLOW", amount: allow.toFixed(2), reason: "Inside every delegated limit", tone: "permission" },
    { decision: "REQUIRE_APPROVAL", amount: review.toFixed(2), reason: approval < hard ? "Crosses the human line" : "Human line meets the hard ceiling", tone: "review" },
    { decision: "DENY", amount: deny.toFixed(2), reason: "Exceeds the hard per-action limit", tone: "denial" }
  ] as const;
}

export function createStudioLabHref(draft: MandateStudioDraft): string | null {
  const vendor = draft.vendors.find((item) => publicLabVendors.some((publicVendor) => publicVendor.id === item.id));
  const capability = draft.capabilities[0];
  if (!vendor || !capability || draft.purpose.trim().length < 3) return null;
  const approval = parseMoney(draft.limits.approvalAbove) ?? 100;
  const hard = parseMoney(draft.limits.perTransaction) ?? 150;
  const amount = approval < hard ? approval + (hard - approval) / 2 : hard * 0.5;
  return createLabHandoffHref({
    capability,
    amount: { value: Math.max(0.01, amount).toFixed(2), currency: "USD" },
    vendor,
    purpose: draft.purpose.trim()
  }, "shared");
}
