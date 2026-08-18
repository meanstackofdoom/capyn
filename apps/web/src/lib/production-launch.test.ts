import { describe, expect, it } from "vitest";
import type { ProductionLaunchResult, SandboxActivationResult } from "@capyn/types";
import {
  createProductionLaunchDraft,
  createProductionLaunchRequest,
  createProductionRecoveryBundle,
  maskProductionCredential,
  slugifyProductionWorkspace,
  validateProductionLaunchDraft
} from "./production-launch";

const activation = {
  workspace: { id: "sbx_org_1", name: "Northstar Systems" }
} as SandboxActivationResult;

describe("production launch handoff", () => {
  it("derives a stable workspace slug and starts with explicit custody boundaries unset", () => {
    expect(slugifyProductionWorkspace("  Northstar / AI Ops  ")).toBe("northstar-ai-ops");
    expect(createProductionLaunchDraft(activation)).toMatchObject({
      workspaceSlug: "northstar-systems",
      planIntent: "DEVELOPER",
      keyCustody: false,
      syntheticExecution: false
    });
  });

  it("validates owner identity, slug, and both launch acknowledgements", () => {
    expect(validateProductionLaunchDraft(createProductionLaunchDraft(activation))).toMatchObject({
      ownerName: expect.any(String),
      ownerEmail: expect.any(String),
      keyCustody: expect.any(String),
      syntheticExecution: expect.any(String)
    });
    expect(validateProductionLaunchDraft({
      ownerName: "Taylor Owner",
      ownerEmail: "taylor@northstar.example",
      workspaceSlug: "northstar-systems",
      planIntent: "TEAM",
      keyCustody: true,
      syntheticExecution: true
    })).toEqual({});
  });

  it("creates the strict API request without leaking sandbox material", () => {
    const request = createProductionLaunchRequest({
      ownerName: " Taylor Owner ",
      ownerEmail: "TAYLOR@NORTHSTAR.EXAMPLE",
      workspaceSlug: "northstar-systems",
      planIntent: "BUSINESS",
      keyCustody: true,
      syntheticExecution: true
    });
    expect(request).toEqual({
      organisation: { slug: "northstar-systems" },
      owner: { name: "Taylor Owner", email: "taylor@northstar.example" },
      planIntent: "BUSINESS",
      acknowledgements: { keyCustody: true, syntheticExecution: true }
    });
    expect(JSON.stringify(request)).not.toContain("capyn_sbx_");
  });

  it("masks credentials and creates an explicit plaintext recovery artifact", () => {
    const key = "capyn_owner_live_abcdefghijklmnopqrstuvwxyz0123456789";
    expect(maskProductionCredential(key)).not.toBe(key);
    expect(maskProductionCredential(key)).toContain("••••");

    const result = {
      createdAt: "2026-08-18T00:00:00.000Z",
      workspace: { id: "org_1", name: "Northstar Systems", slug: "northstar-systems", persistence: "POSTGRESQL" },
      owner: { id: "usr_1", name: "Taylor", email: "taylor@example.com", role: "OWNER" },
      agent: { id: "agt_1", name: "Agent", slug: "agent", status: "ACTIVE" },
      mandate: { id: "man_1", name: "Authority", version: 1, validUntil: "2026-09-18T00:00:00.000Z", capabilities: ["spend.compute"] },
      credentials: {
        owner: { id: "ukey_1", apiKey: key, keyPrefix: "capyn_owner_live_a", scope: "OWNER_CONTROL_PLANE" },
        agent: { id: "key_1", apiKey: "capyn_live_agent-secret", keyPrefix: "capyn_live_agent", scope: "AGENT_AUTHORIZATION" }
      },
      billing: { planIntent: "DEVELOPER", activePlan: "DEVELOPER", checkoutAvailable: false, checkoutUrl: null, note: "Developer active" }
    } as ProductionLaunchResult;
    const recovery = JSON.parse(createProductionRecoveryBundle(result)) as { warning: string; owner: { accessKey: string }; agent: { apiKey: string } };
    expect(recovery.owner.accessKey).toBe(key);
    expect(recovery.agent.apiKey).toBe("capyn_live_agent-secret");
    expect(recovery.warning).toContain("Never commit");
  });
});
