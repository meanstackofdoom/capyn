import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { createDemoMemoryRepository, hashApiKey, type InMemoryCapynRepository } from "@capyn/database";
import { LocalExecutionGateway, createEphemeralExecutionAuthority } from "@capyn/gate";
import type { AuthorizationResult } from "@capyn/types";
import { buildApp } from "../src/app";
import {
  ExecutionService,
  type ExecutionAuthority,
  type ExecutionRequest,
  type PaymentExecutionResult,
  type PaymentExecutor,
  type StaleExecutionSweepResult
} from "../src/domain/execution-service";
import { StaleExecutionSweeper } from "../src/domain/stale-execution-sweeper";
import { agentHeaders, allowedRequest, DEMO_KEY, TEST_NOW, TEST_PEPPER } from "./helpers";

const openApps: FastifyInstance[] = [];

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

class LostSweepExecutor implements PaymentExecutor {
  readonly name: string = "lost-sweep-test";
  executeCalls = 0;
  reconcileCalls = 0;
  executionId: string | null = null;

  async execute(request: ExecutionRequest): Promise<PaymentExecutionResult> {
    this.executeCalls += 1;
    this.executionId = request.executionId;
    throw new Error("The provider response was lost after submission");
  }

  async reconcile(request: ExecutionRequest): Promise<PaymentExecutionResult> {
    this.reconcileCalls += 1;
    expect(request.executionId).toBe(this.executionId);
    return { status: "EXECUTED", reference: `provider_${request.executionId}`, errorCode: null };
  }
}

class UnknownSweepExecutor implements PaymentExecutor {
  readonly name = "unknown-sweep-test";
  executeCalls = 0;
  reconcileCalls = 0;

  async execute(request: ExecutionRequest): Promise<PaymentExecutionResult> {
    this.executeCalls += 1;
    return { status: "UNKNOWN", reference: `pending_${request.executionId}`, errorCode: "PROVIDER_PENDING" };
  }

  async reconcile(): Promise<PaymentExecutionResult> {
    this.reconcileCalls += 1;
    return { status: "UNKNOWN", reference: null, errorCode: "PROVIDER_STILL_PENDING" };
  }
}

class MultiStaleExecutor implements PaymentExecutor {
  readonly name = "multi-stale-test";
  executeCalls = 0;
  reconcileCalls = 0;

  async execute(): Promise<PaymentExecutionResult> {
    this.executeCalls += 1;
    throw new Error("The provider response was lost after submission");
  }

  async reconcile(request: ExecutionRequest): Promise<PaymentExecutionResult> {
    this.reconcileCalls += 1;
    return { status: "EXECUTED", reference: `provider_${request.executionId}`, errorCode: null };
  }
}

class BlockingSweepExecutor extends LostSweepExecutor {
  override readonly name = "blocking-sweep-test";
  readonly reconciliationStarted = deferred();
  readonly releaseReconciliation = deferred();

  override async reconcile(request: ExecutionRequest): Promise<PaymentExecutionResult> {
    this.reconcileCalls += 1;
    expect(request.executionId).toBe(this.executionId);
    this.reconciliationStarted.resolve();
    await this.releaseReconciliation.promise;
    return { status: "EXECUTED", reference: `provider_${request.executionId}`, errorCode: null };
  }
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

interface SweepContext {
  app: FastifyInstance;
  executions: ExecutionService;
  repository: InMemoryCapynRepository;
}

async function createSweepContext(executor: PaymentExecutor, clock: () => Date): Promise<SweepContext> {
  const { repository } = createDemoMemoryRepository(hashApiKey(DEMO_KEY, TEST_PEPPER));
  const ephemeral = createEphemeralExecutionAuthority({
    issuer: "urn:capyn:control:test",
    audience: `urn:capyn:gate:${executor.name}`,
    clock
  });
  const authority: ExecutionAuthority = {
    issuer: ephemeral.issuer,
    gateway: new LocalExecutionGateway({
      gateId: `capyn-test-${executor.name}`,
      gate: ephemeral.gate,
      executor,
      clock
    })
  };
  const executions = new ExecutionService(repository, authority, clock);
  const app = await buildApp({
    repository,
    apiKeyPepper: TEST_PEPPER,
    allowDemoHumanHeader: true,
    bootstrapToken: "capyn-test-bootstrap-token-123456789",
    clock,
    logger: false,
    disableRateLimit: true,
    executionAuthority: authority
  });
  openApps.push(app);
  return { app, executions, repository };
}

async function authorize(app: FastifyInstance, idempotencyKey: string): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/v1/authorize",
    headers: agentHeaders(idempotencyKey),
    payload: allowedRequest
  });
  expect(response.statusCode, response.body).toBe(200);
  return response.json<AuthorizationResult>().authorizationId;
}

async function execute(app: FastifyInstance, authorizationId: string) {
  return app.inject({
    method: "POST",
    url: `/v1/authorizations/${authorizationId}/execute`,
    headers: { authorization: agentHeaders("unused-sweep-execution-header").authorization }
  });
}

describe("stale execution sweep", () => {
  it("reconciles a stale execution under a SYSTEM actor without re-issuing EXECUTE", async () => {
    const provider = new LostSweepExecutor();
    let now = TEST_NOW.getTime();
    const context = await createSweepContext(provider, () => new Date(now));
    const authorizationId = await authorize(context.app, "sweep-reconcile-authorization-0001");

    expect((await execute(context.app, authorizationId)).statusCode).toBe(409);
    expect(provider.executeCalls).toBe(1);
    expect(provider.reconcileCalls).toBe(0);

    now += 31_000;
    const result = await context.executions.sweepStaleExecutions(50);
    expect(result).toEqual({ candidates: 1, reconciled: 1, failed: 0, deferred: 0, skipped: 0 });
    expect(provider.executeCalls).toBe(1);
    expect(provider.reconcileCalls).toBe(1);

    const state = context.repository.inspect();
    expect(state.executions[0]).toMatchObject({
      status: "EXECUTED",
      attemptCount: 2,
      leaseExpiresAt: null
    });
    expect(state.authorizations[0]?.state).toBe("EXECUTED");
    const started = state.auditEvents.find((event) => event.eventType === "EXECUTION_RECONCILIATION_STARTED");
    expect(started).toMatchObject({
      actorType: "SYSTEM",
      actorId: null,
      metadata: {
        requestedByAgentId: null,
        sweepSource: "stale-execution-sweep"
      }
    });
    const reconciled = state.auditEvents.find((event) => event.eventType === "EXECUTION_RECONCILED");
    expect(reconciled).toMatchObject({ actorType: "SYSTEM", actorId: null });
  });

  it("defers an unresolved sweep outcome with a fresh lease while keeping spend reserved", async () => {
    const provider = new UnknownSweepExecutor();
    let now = TEST_NOW.getTime();
    const context = await createSweepContext(provider, () => new Date(now));
    const authorizationId = await authorize(context.app, "sweep-unknown-authorization-0001");

    expect((await execute(context.app, authorizationId)).statusCode).toBe(409);
    now += 31_000;
    expect(await context.executions.sweepStaleExecutions(50)).toEqual({
      candidates: 1, reconciled: 0, failed: 0, deferred: 1, skipped: 0
    });
    let state = context.repository.inspect();
    expect(state.executions[0]).toMatchObject({ status: "PENDING", attemptCount: 2 });
    expect(state.authorizations[0]?.state).toBe("EXECUTING");

    now += 31_000;
    expect(await context.executions.sweepStaleExecutions(50)).toEqual({
      candidates: 1, reconciled: 0, failed: 0, deferred: 1, skipped: 0
    });
    state = context.repository.inspect();
    expect(state.executions[0]).toMatchObject({ status: "PENDING", attemptCount: 3 });
    expect(state.authorizations[0]?.state).toBe("EXECUTING");
    expect(provider.executeCalls).toBe(1);
    expect(provider.reconcileCalls).toBe(2);
  });

  it("does not touch executions whose lease has not expired", async () => {
    const provider = new LostSweepExecutor();
    const now = TEST_NOW.getTime();
    const context = await createSweepContext(provider, () => new Date(now));
    const authorizationId = await authorize(context.app, "sweep-unexpired-authorization-0001");

    expect((await execute(context.app, authorizationId)).statusCode).toBe(409);
    const result = await context.executions.sweepStaleExecutions(50);
    expect(result).toEqual({ candidates: 0, reconciled: 0, failed: 0, deferred: 0, skipped: 0 });
    expect(provider.reconcileCalls).toBe(0);
    expect(context.repository.inspect().authorizations[0]?.state).toBe("EXECUTING");
  });

  it("skips executions already leased by a competing request-driven recovery", async () => {
    const provider = new BlockingSweepExecutor();
    let now = TEST_NOW.getTime();
    const context = await createSweepContext(provider, () => new Date(now));
    const authorizationId = await authorize(context.app, "sweep-competing-authorization-0001");

    expect((await execute(context.app, authorizationId)).statusCode).toBe(409);
    now += 31_000;
    const requestRecovery = execute(context.app, authorizationId);
    await provider.reconciliationStarted.promise;

    expect(await context.executions.sweepStaleExecutions(50)).toEqual({
      candidates: 0, reconciled: 0, failed: 0, deferred: 0, skipped: 0
    });
    expect(provider.reconcileCalls).toBe(1);

    provider.releaseReconciliation.resolve();
    expect((await requestRecovery).statusCode).toBe(200);
    expect(provider.executeCalls).toBe(1);
    expect(provider.reconcileCalls).toBe(1);
    expect(context.repository.inspect().authorizations[0]?.state).toBe("EXECUTED");
  });

  it("never lets concurrent sweeps both claim the same stale execution", async () => {
    const provider = new MultiStaleExecutor();
    let now = TEST_NOW.getTime();
    const context = await createSweepContext(provider, () => new Date(now));
    const authorizationId = await authorize(context.app, "sweep-concurrent-authorization-0001");

    expect((await execute(context.app, authorizationId)).statusCode).toBe(409);
    now += 31_000;
    const [first, second] = await Promise.all([
      context.executions.sweepStaleExecutions(50),
      context.executions.sweepStaleExecutions(50)
    ]);
    expect([first, second]).toEqual(expect.arrayContaining([
      { candidates: 1, reconciled: 1, failed: 0, deferred: 0, skipped: 0 },
      { candidates: 1, reconciled: 0, failed: 0, deferred: 0, skipped: 1 }
    ]));

    const state = context.repository.inspect();
    expect(state.executions[0]?.status).toBe("EXECUTED");
    expect(state.executions[0]?.attemptCount).toBe(2);
    expect(state.authorizations[0]?.state).toBe("EXECUTED");
    expect(provider.executeCalls).toBe(1);
    expect(provider.reconcileCalls).toBe(1);
  });

  it("respects the sweep limit across multiple stale executions", async () => {
    const provider = new MultiStaleExecutor();
    let now = TEST_NOW.getTime();
    const context = await createSweepContext(provider, () => new Date(now));
    const ids: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      ids.push(await authorize(context.app, `sweep-limit-authorization-${index + 1}`));
    }
    for (const authorizationId of ids) {
      expect((await execute(context.app, authorizationId)).statusCode).toBe(409);
    }
    expect(provider.executeCalls).toBe(3);

    now += 31_000;
    const first: StaleExecutionSweepResult = await context.executions.sweepStaleExecutions(2);
    expect(first).toEqual({ candidates: 2, reconciled: 2, failed: 0, deferred: 0, skipped: 0 });

    now += 31_000;
    const second: StaleExecutionSweepResult = await context.executions.sweepStaleExecutions(2);
    expect(second).toEqual({ candidates: 1, reconciled: 1, failed: 0, deferred: 0, skipped: 0 });

    const state = context.repository.inspect();
    expect(state.executions.filter((execution) => execution.status === "EXECUTED")).toHaveLength(3);
    expect(state.authorizations.every((authorization) => authorization.state === "EXECUTED")).toBe(true);
    expect(provider.executeCalls).toBe(3);
    expect(provider.reconcileCalls).toBe(3);
  });

  it("runs on an interval and stops cleanly", async () => {
    const provider = new LostSweepExecutor();
    let now = TEST_NOW.getTime();
    const context = await createSweepContext(provider, () => new Date(now));
    const authorizationId = await authorize(context.app, "sweep-timer-authorization-0001");
    expect((await execute(context.app, authorizationId)).statusCode).toBe(409);
    now += 31_000;

    vi.useFakeTimers();
    const sweeper = new StaleExecutionSweeper({
      executions: context.executions,
      intervalMs: 60_000
    });
    sweeper.start();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(provider.reconcileCalls).toBe(1);
    expect(context.repository.inspect().authorizations[0]?.state).toBe("EXECUTED");

    sweeper.stop();
    await vi.advanceTimersByTimeAsync(300_000);
    expect(provider.reconcileCalls).toBe(1);
    vi.useRealTimers();
  });

  it("rejects invalid sweeper configuration", async () => {
    const provider = new LostSweepExecutor();
    const context = await createSweepContext(provider, () => new Date(TEST_NOW));
    expect(() => new StaleExecutionSweeper({ executions: context.executions, intervalMs: 0 }))
      .toThrow("Stale execution sweep interval must be a positive integer");
    expect(() => new StaleExecutionSweeper({ executions: context.executions, intervalMs: 60_000, limit: 0 }))
      .toThrow("Stale execution sweep limit must be a positive integer");
    await expect(context.executions.sweepStaleExecutions(0))
      .rejects.toThrow("Stale execution sweep limit must be a positive integer");
  });
});
