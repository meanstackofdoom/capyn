import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { AuthorizationResult, ExecutionResultView } from "@capyn/types";
import type {
  ExecutionRequest,
  PaymentExecutionResult,
  PaymentExecutor
} from "../src/domain/execution-service";
import {
  agentHeaders,
  allowedRequest,
  createTestContext,
  TEST_NOW
} from "./helpers";

const openApps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

class LostResponseExecutor implements PaymentExecutor {
  readonly name: string = "lost-response-test";
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
    return {
      status: "EXECUTED",
      reference: `provider_${request.executionId}`,
      errorCode: null
    };
  }
}

class AlwaysUnknownExecutor implements PaymentExecutor {
  readonly name: string = "unknown-test";
  executeCalls = 0;
  reconcileCalls = 0;

  async execute(request: ExecutionRequest): Promise<PaymentExecutionResult> {
    this.executeCalls += 1;
    return {
      status: "UNKNOWN",
      reference: `pending_${request.executionId}`,
      errorCode: "PROVIDER_PENDING"
    };
  }

  async reconcile(): Promise<PaymentExecutionResult> {
    this.reconcileCalls += 1;
    return { status: "UNKNOWN", reference: null, errorCode: "PROVIDER_STILL_PENDING" };
  }
}

class BlockingRecoveryExecutor extends LostResponseExecutor {
  override readonly name: string = "blocking-recovery-test";
  readonly reconciliationStarted = deferred();
  readonly releaseReconciliation = deferred();

  override async reconcile(request: ExecutionRequest): Promise<PaymentExecutionResult> {
    this.reconcileCalls += 1;
    expect(request.executionId).toBe(this.executionId);
    this.reconciliationStarted.resolve();
    await this.releaseReconciliation.promise;
    return {
      status: "EXECUTED",
      reference: `provider_${request.executionId}`,
      errorCode: null
    };
  }
}

async function authorize(app: FastifyInstance, key: string): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/v1/authorize",
    headers: agentHeaders(key),
    payload: allowedRequest
  });
  expect(response.statusCode, response.body).toBe(200);
  return response.json<AuthorizationResult>().authorizationId;
}

async function execute(app: FastifyInstance, authorizationId: string) {
  return app.inject({
    method: "POST",
    url: `/v1/authorizations/${authorizationId}/execute`,
    headers: { authorization: agentHeaders("unused-execution-header").authorization }
  });
}

describe("execution reconciliation", () => {
  it("reconciles a lost provider response without issuing a second payment", async () => {
    const provider = new LostResponseExecutor();
    let now = TEST_NOW.getTime();
    const context = await createTestContext({ executor: provider, clock: () => new Date(now) });
    openApps.push(context.app);
    const authorizationId = await authorize(context.app, "lost-response-authorization-0001");

    const first = await execute(context.app, authorizationId);
    expect(first.statusCode).toBe(409);
    expect(first.json<{ error: { code: string } }>().error.code).toBe("EXECUTION_OUTCOME_UNKNOWN");
    expect(provider.executeCalls).toBe(1);
    expect(provider.reconcileCalls).toBe(0);

    const beforeLease = await execute(context.app, authorizationId);
    expect(beforeLease.statusCode).toBe(409);
    expect(beforeLease.json<{ error: { code: string } }>().error.code).toBe("EXECUTION_IN_PROGRESS");
    expect(provider.reconcileCalls).toBe(0);

    now += 31_000;
    const recovered = await execute(context.app, authorizationId);
    expect(recovered.statusCode, recovered.body).toBe(200);
    const recoveredBody = recovered.json<ExecutionResultView>();
    expect(recoveredBody).toMatchObject({ status: "EXECUTED", reference: `provider_${provider.executionId}` });
    expect(provider.executeCalls).toBe(1);
    expect(provider.reconcileCalls).toBe(1);

    const replay = await execute(context.app, authorizationId);
    expect(replay.json<ExecutionResultView>()).toEqual(recoveredBody);
    expect(provider.executeCalls).toBe(1);
    expect(provider.reconcileCalls).toBe(1);

    const state = context.repository.inspect();
    expect(state.executions[0]).toMatchObject({
      status: "EXECUTED",
      attemptCount: 2,
      leaseExpiresAt: null
    });
    expect(state.authorizations[0]?.state).toBe("EXECUTED");
    expect(state.auditEvents.map((event) => event.eventType)).toEqual(expect.arrayContaining([
      "EXECUTION_CLAIMED",
      "EXECUTION_OUTCOME_UNKNOWN",
      "EXECUTION_RECONCILIATION_STARTED",
      "EXECUTION_RECONCILED"
    ]));
  });

  it("keeps an unresolved provider outcome reserved and never reissues execution", async () => {
    const provider = new AlwaysUnknownExecutor();
    let now = TEST_NOW.getTime();
    const context = await createTestContext({ executor: provider, clock: () => new Date(now) });
    openApps.push(context.app);
    const authorizationId = await authorize(context.app, "unknown-provider-authorization-0001");

    expect((await execute(context.app, authorizationId)).statusCode).toBe(409);
    now += 31_000;
    const unresolved = await execute(context.app, authorizationId);
    expect(unresolved.statusCode).toBe(409);
    expect(unresolved.json<{ error: { code: string } }>().error.code).toBe("EXECUTION_OUTCOME_UNKNOWN");
    expect(provider.executeCalls).toBe(1);
    expect(provider.reconcileCalls).toBe(1);

    const state = context.repository.inspect();
    expect(state.executions[0]).toMatchObject({
      status: "PENDING",
      attemptCount: 2,
      externalReference: `pending_${state.executions[0]!.id}`,
      errorCode: "PROVIDER_STILL_PENDING"
    });
    expect(state.authorizations[0]?.state).toBe("EXECUTING");
    expect(state.auditEvents.filter((event) => event.eventType === "EXECUTION_OUTCOME_UNKNOWN")).toHaveLength(2);
  });

  it("leases reconciliation so competing retries cannot both call the provider", async () => {
    const provider = new BlockingRecoveryExecutor();
    let now = TEST_NOW.getTime();
    const context = await createTestContext({ executor: provider, clock: () => new Date(now) });
    openApps.push(context.app);
    const authorizationId = await authorize(context.app, "competing-recovery-authorization-0001");
    expect((await execute(context.app, authorizationId)).statusCode).toBe(409);

    now += 31_000;
    const firstRecovery = execute(context.app, authorizationId);
    await provider.reconciliationStarted.promise;
    const competingRecovery = await execute(context.app, authorizationId);
    expect(competingRecovery.statusCode).toBe(409);
    expect(competingRecovery.json<{ error: { code: string } }>().error.code).toBe("EXECUTION_IN_PROGRESS");

    provider.releaseReconciliation.resolve();
    expect((await firstRecovery).json<ExecutionResultView>().status).toBe("EXECUTED");
    expect(provider.executeCalls).toBe(1);
    expect(provider.reconcileCalls).toBe(1);
  });
});
