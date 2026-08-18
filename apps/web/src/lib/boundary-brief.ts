export const BOUNDARY_BRIEF_SCHEMA_VERSION = 1;

export const BOUNDARY_STAGE_OPTIONS = [
  "Prototype using synthetic data",
  "Internal or sandbox workflow",
  "Limited production workflow",
  "Production workload",
  "Not built yet"
] as const;

export const BOUNDARY_HUMAN_OPTIONS = [
  "No human checkpoint yet",
  "Manual approval outside the product",
  "Approval exists but is not request-bound",
  "Request-bound approval already exists",
  "This action should never require approval"
] as const;

export type BoundaryStage = (typeof BOUNDARY_STAGE_OPTIONS)[number];
export type BoundaryHumanLine = (typeof BOUNDARY_HUMAN_OPTIONS)[number];

export interface BoundaryBriefDraft {
  organisation: string;
  stage: BoundaryStage;
  action: string;
  consequence: string;
  humanLine: BoundaryHumanLine;
  executionContext: string;
  usefulOutcome: string;
}

export type BoundaryBriefField = keyof BoundaryBriefDraft;
export type BoundaryBriefErrors = Partial<Record<BoundaryBriefField, string>>;

const limits = {
  organisation: 120,
  action: 240,
  consequence: 360,
  executionContext: 240,
  usefulOutcome: 300
} as const;

function bounded(value: string, minimum: number, maximum: number): boolean {
  const length = value.trim().length;
  return length >= minimum && length <= maximum;
}

export function validateBoundaryBrief(draft: BoundaryBriefDraft): BoundaryBriefErrors {
  const errors: BoundaryBriefErrors = {};
  if (draft.organisation.length > limits.organisation) errors.organisation = "Keep the organisation or project under 120 characters.";
  if (!BOUNDARY_STAGE_OPTIONS.includes(draft.stage)) errors.stage = "Choose the current delivery stage.";
  if (!bounded(draft.action, 20, limits.action)) errors.action = "Name one exact action in 20–240 characters.";
  if (!bounded(draft.consequence, 20, limits.consequence)) errors.consequence = "Describe the consequence and hard stop in 20–360 characters.";
  if (!BOUNDARY_HUMAN_OPTIONS.includes(draft.humanLine)) errors.humanLine = "Choose the current human checkpoint.";
  if (draft.executionContext.length > limits.executionContext) errors.executionContext = "Keep the execution context under 240 characters.";
  if (!bounded(draft.usefulOutcome, 20, limits.usefulOutcome)) errors.usefulOutcome = "Describe the smallest useful outcome in 20–300 characters.";
  return errors;
}

function clean(value: string): string {
  return value.trim().replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n");
}

function line(value: string): string {
  return clean(value) || "Not supplied";
}

export function createBoundaryBriefMarkdown(draft: BoundaryBriefDraft, generatedAt = new Date().toISOString()): string {
  if (Object.keys(validateBoundaryBrief(draft)).length > 0) {
    throw new Error("A complete, valid boundary brief is required.");
  }

  return [
    "# CAPYN private boundary brief",
    "",
    "> Browser-local draft. Review before sending. No authority, account or production commitment has been created.",
    "",
    "- Schema: boundary-brief/v" + BOUNDARY_BRIEF_SCHEMA_VERSION,
    "- Generated: " + generatedAt,
    "- Organisation / project: " + line(draft.organisation),
    "- Current stage: " + draft.stage,
    "",
    "## One exact consequential action",
    "",
    line(draft.action),
    "",
    "## Consequence and hard stop",
    "",
    line(draft.consequence),
    "",
    "## Current human checkpoint",
    "",
    draft.humanLine,
    "",
    "## Execution context",
    "",
    line(draft.executionContext),
    "",
    "## Smallest useful outcome",
    "",
    line(draft.usefulOutcome),
    "",
    "## Handling boundary",
    "",
    "This file may contain private commercial or architecture context. Send it only through a channel you trust. Do not include credentials, private keys, account numbers, payment details, customer data or regulated personal information.",
    ""
  ].join("\n");
}

export function boundaryBriefFilename(organisation: string): string {
  const slug = organisation
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return "capyn-boundary-brief" + (slug ? "-" + slug : "") + ".md";
}

export function isContactEmail(value: string | undefined): value is string {
  if (!value || value.length > 254 || /[\r\n]/.test(value)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function createBoundaryBriefMailto(email: string, draft: BoundaryBriefDraft): string {
  if (!isContactEmail(email)) throw new Error("A valid public contact email is required.");
  const subject = "CAPYN boundary brief" + (draft.organisation.trim() ? " — " + draft.organisation.trim() : "");
  const params = new URLSearchParams({
    subject,
    body: createBoundaryBriefMarkdown(draft)
  });
  return "mailto:" + email + "?" + params.toString();
}

