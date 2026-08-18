import type {
  ProductionLaunchRequest,
  ProductionLaunchResult,
  SandboxActivationResult
} from "@capyn/types";

export const OWNER_SESSION_STORAGE_KEY = "capyn_owner_access_key";

export type ProductionPlanIntent = ProductionLaunchRequest["planIntent"];

export interface ProductionLaunchDraft {
  ownerName: string;
  ownerEmail: string;
  workspaceSlug: string;
  planIntent: ProductionPlanIntent;
  keyCustody: boolean;
  syntheticExecution: boolean;
}

export type ProductionLaunchField = keyof ProductionLaunchDraft;
export type ProductionLaunchErrors = Partial<Record<ProductionLaunchField, string>>;

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function slugifyProductionWorkspace(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export function createProductionLaunchDraft(
  activation: SandboxActivationResult
): ProductionLaunchDraft {
  return {
    ownerName: "",
    ownerEmail: "",
    workspaceSlug: slugifyProductionWorkspace(activation.workspace.name),
    planIntent: "DEVELOPER",
    keyCustody: false,
    syntheticExecution: false
  };
}

export function validateProductionLaunchDraft(
  draft: ProductionLaunchDraft
): ProductionLaunchErrors {
  const errors: ProductionLaunchErrors = {};
  if (draft.ownerName.trim().length < 2) errors.ownerName = "Name the person who will hold owner authority.";
  if (!emailPattern.test(draft.ownerEmail.trim()) || draft.ownerEmail.trim().length > 320) {
    errors.ownerEmail = "Enter a valid owner email address.";
  }
  if (draft.workspaceSlug.length < 2 || !slugPattern.test(draft.workspaceSlug)) {
    errors.workspaceSlug = "Use a lowercase workspace slug such as northstar-systems.";
  }
  if (!draft.keyCustody) errors.keyCustody = "Confirm who will secure the one-time access keys.";
  if (!draft.syntheticExecution) {
    errors.syntheticExecution = "Confirm that execution remains synthetic in the hosted alpha.";
  }
  return errors;
}

export function createProductionLaunchRequest(
  draft: ProductionLaunchDraft
): ProductionLaunchRequest {
  return {
    organisation: { slug: draft.workspaceSlug },
    owner: { name: draft.ownerName.trim(), email: draft.ownerEmail.trim().toLowerCase() },
    planIntent: draft.planIntent,
    acknowledgements: { keyCustody: true, syntheticExecution: true }
  };
}

export function maskProductionCredential(value: string): string {
  return `${value.slice(0, 18)}${"•".repeat(22)}${value.slice(-6)}`;
}

export function createProductionRecoveryBundle(result: ProductionLaunchResult): string {
  return JSON.stringify(
    {
      schemaVersion: 1,
      kind: "CAPYN_HOSTED_ALPHA_RECOVERY",
      createdAt: result.createdAt,
      warning: "Contains plaintext credentials. Store in a secret manager. Never commit or share this file.",
      workspace: result.workspace,
      owner: {
        id: result.owner.id,
        name: result.owner.name,
        email: result.owner.email,
        accessKey: result.credentials.owner.apiKey
      },
      agent: {
        id: result.agent.id,
        name: result.agent.name,
        slug: result.agent.slug,
        apiKey: result.credentials.agent.apiKey
      },
      mandate: result.mandate,
      billing: {
        planIntent: result.billing.planIntent,
        activePlan: result.billing.activePlan
      }
    },
    null,
    2
  );
}
