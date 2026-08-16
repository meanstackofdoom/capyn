import { createDemoMemoryRepository, hashApiKey } from "@capyn/database";
import type { AuthorizationResult } from "@capyn/types";
import { buildApp } from "../apps/api/src/app";

const API_KEY = "capyn_demo_N7m2kQ4xR8vB3pL6sT9wY1cF5hJ0dG2a";
const PEPPER = "capyn-demo-pepper-with-at-least-thirty-two-characters";
const NOW = new Date("2026-08-16T10:00:00.000Z");

const { repository } = createDemoMemoryRepository(hashApiKey(API_KEY, PEPPER));
const app = await buildApp({
  repository,
  apiKeyPepper: PEPPER,
  allowDemoHumanHeader: true,
  clock: () => new Date(NOW),
  logger: false,
  disableRateLimit: true
});

const scenarios = [
  {
    label: "$18.00 → OpenAI",
    request: {
      capability: "spend.compute",
      amount: { value: "18.00", currency: "USD" },
      vendor: { id: "openai", name: "OpenAI" },
      metadata: { purpose: "Purchase inference capacity" }
    }
  },
  {
    label: "$30.00 → UnknownVendor",
    request: {
      capability: "spend.compute",
      amount: { value: "30.00", currency: "USD" },
      vendor: { id: "unknown-vendor", name: "UnknownVendor" },
      metadata: { purpose: "Unapproved API" }
    }
  },
  {
    label: "$120.00 → AWS",
    request: {
      capability: "spend.compute",
      amount: { value: "120.00", currency: "USD" },
      vendor: { id: "aws", name: "AWS" },
      metadata: { purpose: "Scale a training workload" }
    }
  },
  {
    label: "transfer.wallet · $20.00",
    request: {
      capability: "transfer.wallet",
      amount: { value: "20.00", currency: "USD" },
      vendor: { id: "openai", name: "OpenAI" },
      metadata: { purpose: "Treasury transfer" }
    }
  }
] as const;

process.stdout.write("\nCAPYN · authority decision demo\n");
process.stdout.write("procurement-agent / Acme AI\n\n");

for (const [index, scenario] of scenarios.entries()) {
  const response = await app.inject({
    method: "POST",
    url: "/v1/authorize",
    headers: {
      authorization: `Bearer ${API_KEY}`,
      "idempotency-key": `demo-scenario-${index + 1}-0000`,
      "content-type": "application/json"
    },
    payload: scenario.request
  });
  const result = response.json<AuthorizationResult>();
  const mark = result.decision === "ALLOW" ? "✓" : result.decision === "DENY" ? "✗" : "!";
  process.stdout.write(`${mark} ${scenario.label}\n  ${result.decision}\n  ${result.reasonCodes.join(", ")}\n`);
  if (result.decision === "REQUIRE_APPROVAL") process.stdout.write(`  approval: ${result.approvalId}\n`);
  process.stdout.write("\n");
}

const dashboard = await app.inject({
  method: "GET",
  url: "/v1/dashboard",
  headers: { "x-capyn-user-id": "usr_demo_owner" }
});
const summary = dashboard.json<{ authorizations: unknown[]; auditEvents: unknown[] }>();
process.stdout.write(`${summary.authorizations.length} authorizations · ${summary.auditEvents.length} audit events recorded\n\n`);
await app.close();
