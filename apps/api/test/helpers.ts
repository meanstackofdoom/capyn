import type { FastifyInstance } from "fastify";
import { createDemoMemoryRepository, hashApiKey, type InMemoryCapynRepository } from "@capyn/database";
import { createEphemeralExecutionAuthority } from "@capyn/gate";
import { buildApp } from "../src/app";
import type { BillingProvider } from "../src/domain/billing-provider";
import type { ExecutionAuthority, PaymentExecutor } from "../src/domain/execution-service";

export const TEST_PEPPER = "capyn-test-pepper-with-at-least-thirty-two-characters";
export const TEST_NOW = new Date("2026-08-16T10:00:00.000Z");
export const DEMO_KEY = "capyn_demo_N7m2kQ4xR8vB3pL6sT9wY1cF5hJ0dG2a";

export interface TestContext {
  app: FastifyInstance;
  repository: InMemoryCapynRepository;
}

export async function createTestContext(options: {
  billingProvider?: BillingProvider;
  clock?: () => Date;
  demoHumanUserId?: string;
  executor?: PaymentExecutor;
  executionAuthority?: ExecutionAuthority;
} = {}): Promise<TestContext> {
  const { repository } = createDemoMemoryRepository(hashApiKey(DEMO_KEY, TEST_PEPPER));
  const clock = options.clock ?? (() => new Date(TEST_NOW));
  const executionAuthority = options.executionAuthority ?? (options.executor
    ? createEphemeralExecutionAuthority({
        issuer: "urn:capyn:control:test",
        audience: `urn:capyn:gate:${options.executor.name}`,
        clock
      })
    : undefined);
  const app = await buildApp({
    repository,
    apiKeyPepper: TEST_PEPPER,
    allowDemoHumanHeader: true,
    ...(options.demoHumanUserId ? { demoHumanUserId: options.demoHumanUserId } : {}),
    bootstrapToken: "capyn-test-bootstrap-token-123456789",
    clock,
    logger: process.env.CAPYN_TEST_LOGS === "true",
    disableRateLimit: true,
    ...(options.billingProvider ? { billingProvider: options.billingProvider } : {}),
    ...(options.executor ? { executor: options.executor } : {}),
    ...(executionAuthority ? { executionAuthority } : {})
  });
  return { app, repository };
}

export const allowedRequest = {
  capability: "spend.compute",
  amount: { value: "18.00", currency: "USD" },
  vendor: { id: "openai", name: "OpenAI" },
  metadata: { purpose: "Purchase inference capacity" }
} as const;

export function agentHeaders(idempotencyKey: string): Record<string, string> {
  return {
    authorization: `Bearer ${DEMO_KEY}`,
    "idempotency-key": idempotencyKey,
    "content-type": "application/json"
  };
}

export const ownerHeaders = {
  "x-capyn-user-id": "usr_demo_owner",
  "content-type": "application/json"
};
