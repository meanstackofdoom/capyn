import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createVolumeCapynRepository } from "./memory-repository";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((folder) => rm(folder, { recursive: true, force: true })));
});

async function statePath(): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), "capyn-volume-test-"));
  temporaryDirectories.push(folder);
  return join(folder, "nested", "capyn-state.v8");
}

describe("single-service volume repository", () => {
  it("atomically checkpoints committed tenant state and restores it after restart", async () => {
    const path = await statePath();
    const first = await createVolumeCapynRepository(path, "a".repeat(64));
    await first.repository.transaction((tx) => tx.createOrganisation({
      organisation: { id: "org_volume_test", name: "Volume Test", slug: "volume-test" },
      owner: { id: "usr_volume_owner", name: "Volume Owner", email: "owner@volume.test" },
      subscription: {
        id: "sub_volume_test",
        currentPeriodStart: new Date("2026-08-01T00:00:00.000Z"),
        currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z")
      }
    }));

    const restarted = await createVolumeCapynRepository(path, "a".repeat(64));
    await expect(restarted.repository.findUser("usr_volume_owner")).resolves.toMatchObject({
      organisationId: "org_volume_test",
      email: "owner@volume.test",
      role: "OWNER"
    });
  });

  it("fails closed instead of replacing an unreadable state file", async () => {
    const path = await statePath();
    await createVolumeCapynRepository(path, "b".repeat(64));
    await writeFile(path, Buffer.from("not-a-capyn-state"));
    await expect(createVolumeCapynRepository(path, "b".repeat(64))).rejects.toThrow();
  });
});
