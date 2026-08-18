import { Prisma, type PrismaClient } from "@prisma/client";
import type { ExecutionClaimReplayStore } from "@capyn/gate";

type ReplayClient = Pick<PrismaClient, "executionClaimConsumption">;

function replayNamespace(value: string): string {
  const parsed = value.trim();
  if (parsed.length === 0 || parsed.length > 240) {
    throw new Error("Execution claim replay namespace must contain 1 to 240 characters");
  }
  return parsed;
}

export class PrismaExecutionClaimReplayStore implements ExecutionClaimReplayStore {
  private readonly namespace: string;

  constructor(
    private readonly client: ReplayClient,
    namespace: string
  ) {
    this.namespace = replayNamespace(namespace);
  }

  async consume(claimId: string, expiresAtEpochSeconds: number): Promise<boolean> {
    if (!/^[a-f0-9]{64}$/.test(claimId)) throw new Error("Execution claim ID must be a SHA-256 digest");
    if (!Number.isSafeInteger(expiresAtEpochSeconds) || expiresAtEpochSeconds < 0) {
      throw new Error("Execution claim expiry must be a non-negative epoch second");
    }
    const expiresAt = new Date(expiresAtEpochSeconds * 1_000);
    if (Number.isNaN(expiresAt.getTime())) throw new Error("Execution claim expiry is outside the supported range");
    try {
      await this.client.executionClaimConsumption.create({
        data: { namespace: this.namespace, claimId, expiresAt }
      });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return false;
      throw error;
    }
  }
}
