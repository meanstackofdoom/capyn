import { Capyn } from "@capyn/sdk";

const apiKey = process.env.CAPYN_API_KEY;
if (!apiKey) throw new Error("Set CAPYN_API_KEY before running this example");

const capyn = new Capyn({
  apiKey,
  baseUrl: process.env.CAPYN_API_URL ?? "http://localhost:4000"
});

const result = await capyn.authorize(
  {
    capability: "spend.compute",
    amount: { value: "18.42", currency: "USD" },
    vendor: { id: "openai", name: "OpenAI" },
    metadata: { purpose: "Purchase inference capacity" }
  },
  { idempotencyKey: "sdk-example-inference-0001" }
);

if (result.decision === "ALLOW") process.stdout.write(`Allowed: ${result.authorizationId}\n`);
if (result.decision === "REQUIRE_APPROVAL") process.stdout.write(`Await approval: ${result.approvalId}\n`);
if (result.decision === "DENY") process.stdout.write(`Denied: ${result.reasonCodes.join(", ")}\n`);
