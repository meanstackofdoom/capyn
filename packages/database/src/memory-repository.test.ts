import { describe, expect, it } from "vitest";
import { hashApiKey } from "./credentials";
import { createDemoMemoryRepository } from "./memory-repository";

const pepper = "capyn-test-pepper-with-at-least-32-characters";
const demoKey = "capyn_demo_N7m2kQ4xR8vB3pL6sT9wY1cF5hJ0dG2a";
const now = new Date("2026-08-16T10:00:00.000Z");

async function seedExecution(
  repository: ReturnType<typeof createDemoMemoryRepository>["repository"],
  id: string,
  authorizationId: string,
  lastAttemptAt: Date,
  leaseExpiresAt: Date
): Promise<void> {
  await repository.transaction(async (tx) => {
    await tx.createExecution({
      id,
      organisationId: "org_demo_acme",
      authorizationId,
      provider: "mock",
      attemptedAt: lastAttemptAt,
      leaseExpiresAt
    });
  });
}

describe("in-memory repository stale execution scan", () => {
  it("returns only pending expired-lease executions ordered by oldest attempt", async () => {
    const { repository } = createDemoMemoryRepository(hashApiKey(demoKey, pepper));
    await seedExecution(repository, "exe_stale_1", "aut_stale_1", new Date(now.getTime() - 40_000), new Date(now.getTime() - 10_000));
    await seedExecution(repository, "exe_stale_2", "aut_stale_2", new Date(now.getTime() - 30_000), new Date(now.getTime() - 5_000));
    await seedExecution(repository, "exe_active_1", "aut_active_1", new Date(now.getTime() - 20_000), new Date(now.getTime() + 5_000));
    await seedExecution(repository, "exe_stale_3", "aut_stale_3", new Date(now.getTime() - 50_000), new Date(now.getTime() - 20_000));
    await repository.transaction(async (tx) => {
      await tx.completeExecution("exe_stale_1", 1, {
        status: "FAILED",
        externalReference: null,
        errorCode: "GATE_INTERNAL_ERROR",
        completedAt: now
      });
    });

    const stale = await repository.findStaleExecutions(now, 2);
    expect(stale.map((execution) => execution.id)).toEqual(["exe_stale_3", "exe_stale_2"]);
  });

  it("respects the scan limit and ignores executions that are not yet stale", async () => {
    const { repository } = createDemoMemoryRepository(hashApiKey(demoKey, pepper));
    await seedExecution(repository, "exe_stale_1", "aut_stale_1", new Date(now.getTime() - 40_000), new Date(now.getTime() - 10_000));
    await seedExecution(repository, "exe_stale_2", "aut_stale_2", new Date(now.getTime() - 30_000), new Date(now.getTime() - 5_000));
    await seedExecution(repository, "exe_active_1", "aut_active_1", new Date(now.getTime() - 20_000), new Date(now.getTime() + 5_000));

    const limited = await repository.findStaleExecutions(now, 1);
    expect(limited.map((execution) => execution.id)).toEqual(["exe_stale_1"]);

    const beforeLease = new Date(now.getTime() - 60_000);
    expect(await repository.findStaleExecutions(beforeLease, 10)).toEqual([]);
  });
});
