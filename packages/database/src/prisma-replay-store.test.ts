import { Prisma, type PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { PrismaExecutionClaimReplayStore } from "./prisma-replay-store";

const CLAIM_ID = "a".repeat(64);

function clientWith(create: ReturnType<typeof vi.fn>): Pick<PrismaClient, "executionClaimConsumption"> {
  return { executionClaimConsumption: { create } } as unknown as Pick<PrismaClient, "executionClaimConsumption">;
}

describe("PrismaExecutionClaimReplayStore", () => {
  it("atomically inserts a namespaced replay record", async () => {
    const create = vi.fn().mockResolvedValue({});
    const store = new PrismaExecutionClaimReplayStore(clientWith(create), "issuer|audience");

    await expect(store.consume(CLAIM_ID, 1_787_063_400)).resolves.toBe(true);
    expect(create).toHaveBeenCalledWith({
      data: {
        namespace: "issuer|audience",
        claimId: CLAIM_ID,
        expiresAt: new Date("2026-08-18T14:30:00.000Z")
      }
    });
  });

  it("maps the database uniqueness barrier to a replay refusal", async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError("duplicate", {
      code: "P2002",
      clientVersion: "6.16.1",
      meta: { target: ["namespace", "claim_id"] }
    });
    const store = new PrismaExecutionClaimReplayStore(
      clientWith(vi.fn().mockRejectedValue(conflict)),
      "issuer|audience"
    );

    await expect(store.consume(CLAIM_ID, 1_787_063_400)).resolves.toBe(false);
  });

  it("does not turn storage failure into replay success", async () => {
    const store = new PrismaExecutionClaimReplayStore(
      clientWith(vi.fn().mockRejectedValue(new Error("database unavailable"))),
      "issuer|audience"
    );

    await expect(store.consume(CLAIM_ID, 1_787_063_400)).rejects.toThrow("database unavailable");
  });
});
