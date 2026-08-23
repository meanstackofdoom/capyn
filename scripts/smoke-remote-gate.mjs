import { generateKeyPairSync } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dirname, "..");
const gatePort = 4100;
const apiPort = 4110;
const gateOrigin = `http://127.0.0.1:${gatePort}`;
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const agentApiKey = "capyn_demo_N7m2kQ4xR8vB3pL6sT9wY1cF5hJ0dG2a";
const demoUserId = "usr_demo_owner";
const children = [];
const controlToken = "capyn-gate-control-token-at-least-32-characters";
const gateId = "gate-aws-dry-run-smoke";
const issuer = "urn:capyn:control:smoke";
const audience = "urn:capyn:gate:aws-smoke";
const keyId = "smoke-key-1";
const providerName = "aws-ec2-dry-run";

const baseRequest = {
  capability: "spend.compute",
  amount: { value: "18.00", currency: "USD" },
  vendor: { id: "openai", name: "OpenAI" },
  metadata: { purpose: "Production smoke test" }
};
const awsDryRunRequest = {
  capability: "aws.ec2.run-instances.dry-run",
  amount: { value: "120.00", currency: "USD" },
  vendor: { id: "aws", name: "AWS" },
  metadata: {
    mode: "DRY_RUN",
    environment: "sandbox",
    blueprintId: "capyn-t3-micro-v1",
    region: "ap-southeast-2",
    instanceCount: 1,
    purpose: "Production smoke test"
  }
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

async function assertPortAvailable(port) {
  await new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", () => reject(new Error(`Port ${port} is already in use`)));
    server.listen(port, "127.0.0.1", () => server.close(resolvePort));
  });
}

function launch(name, args, environment) {
  const output = [];
  const child = spawn(process.execPath, args, {
    cwd: root,
    env: environment,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });
  const capture = (chunk) => {
    output.push(String(chunk));
    if (output.join("").length > 20_000) output.shift();
  };
  child.stdout.on("data", capture);
  child.stderr.on("data", capture);
  children.push({ name, child, output });
  return child;
}

async function stopChildren() {
  await Promise.all(children.map(async ({ child }) => {
    if (child.exitCode !== null) return;
    child.kill("SIGTERM");
    await Promise.race([
      new Promise((resolveExit) => child.once("exit", resolveExit)),
      delay(3_000)
    ]);
    if (child.exitCode === null) child.kill("SIGKILL");
  }));
}

async function waitFor(url, path = "/health") {
  const fullUrl = `${url}${path}`;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(fullUrl, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return response;
    } catch {
      // Services need time to bind before accepting traffic.
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${fullUrl}`);
}

async function request(url, init = {}, expectedStatus = 200) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(5_000) });
  assert(response.status === expectedStatus, `${init.method ?? "GET"} ${url} returned ${response.status}, expected ${expectedStatus}`);
  return response;
}

function agentHeaders(idempotencyKey) {
  return {
    Authorization: `Bearer ${agentApiKey}`,
    "Content-Type": "application/json",
    ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
  };
}

async function authorize(idempotencyKey, body, expectedStatus = 200) {
  const response = await request(`${apiOrigin}/v1/authorize`, {
    method: "POST",
    headers: agentHeaders(idempotencyKey),
    body: JSON.stringify(body)
  }, expectedStatus);
  return response.json();
}

async function smokeApi() {
  const apiHealth = await (await request(`${apiOrigin}/health`)).json();
  assert(apiHealth.status === "ok" && apiHealth.service === "capyn-api", "API health payload is invalid");

  const gateHealth = await (await request(`${gateOrigin}/healthz`)).json();
  assert(
    gateHealth.receiptSigningEnabled === true &&
      gateHealth.service === "capyn-gate" &&
      gateHealth.status === "ok",
    "Gate health payload is invalid or does not report receipt readiness"
  );
  const gateReady = await (await request(`${gateOrigin}/ready`)).json();
  assert(gateReady.status === "ready", "Gate was not ready");

  const allow = await authorize("production-smoke-allow-0001", baseRequest);
  assert(allow.decision === "ALLOW", "Seeded OpenAI request was not allowed");

  const unknown = await authorize("production-smoke-unknown-0001", {
    ...baseRequest,
    amount: { value: "30.00", currency: "USD" },
    vendor: { id: "unknown", name: "UnknownVendor" }
  });
  assert(unknown.decision === "DENY" && unknown.reasonCodes.includes("VENDOR_NOT_ALLOWED"), "Unknown vendor did not fail closed");

  const approval = await authorize("production-smoke-approval-0001", awsDryRunRequest, 202);
  assert(approval.decision === "REQUIRE_APPROVAL" && approval.approvalId, "AWS threshold did not request approval");

  const approved = await (await request(`${apiOrigin}/v1/approvals/${approval.approvalId}/decision`, {
    method: "POST",
    headers: { "x-capyn-user-id": demoUserId, "Content-Type": "application/json" },
    body: JSON.stringify({ decision: "APPROVE", comment: "Production smoke approval" })
  })).json();
  assert(approved.status === "APPROVED", "Approval did not bind to the exact request");

  const execution = await (await request(`${apiOrigin}/v1/authorizations/${approval.authorizationId}/execute`, {
    method: "POST",
    headers: { Authorization: `Bearer ${agentApiKey}` }
  })).json();
  assert(
    execution.status === "EXECUTED" &&
      execution.provider === providerName,
    "Remote Gate execution did not complete through the expected provider"
  );

  return { apiHealth: apiHealth.service, executionProvider: execution.provider };
}

const { publicKey, privateKey } = generateKeyPairSync("ec", {
  namedCurve: "P-256",
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" }
});
const keyPairLabel = JSON.stringify({ [keyId]: publicKey });
const blueprint = [{
  id: "capyn-t3-micro-v1",
  region: "ap-southeast-2",
  instanceType: "t3.micro",
  imageFamily: "al2023",
  instanceCount: 1,
  maxMonthlyCostMinor: "12000"
}];
const receiptSecret = "capyn-remote-gate-receipt-secret-2026";
let report;

try {
  await Promise.all([assertPortAvailable(gatePort), assertPortAvailable(apiPort)]);
  const gateEnvironment = {
    ...process.env,
    NODE_ENV: "development",
    PORT: String(gatePort),
    HOST: "127.0.0.1",
    GATE_REPLAY_STORAGE: "memory",
    GATE_CONTROL_TOKEN: controlToken,
    GATE_ID: gateId,
    GATE_EXPECTED_ISSUER: issuer,
    GATE_AUDIENCE: audience,
    GATE_PUBLIC_KEYS_B64: Buffer.from(keyPairLabel).toString("base64"),
    GATE_RECEIPT_SIGNING_SECRET_B64: Buffer.from(receiptSecret).toString("base64"),
    AWS_SANDBOX_BLUEPRINTS_B64: Buffer.from(JSON.stringify(blueprint)).toString("base64")
  };
  launch("gate", [resolve(root, "apps/gate/dist/index.js")], gateEnvironment);
  await Promise.all([waitFor(gateOrigin, "/healthz"), waitFor(gateOrigin, "/ready")]);
  const apiEnvironment = {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(apiPort),
    HOST: "127.0.0.1",
    TRUST_PROXY: "false",
    CAPYN_STORAGE: "memory",
    API_KEY_PEPPER: "capyn-production-smoke-pepper-2026-do-not-use-live",
    WEB_ORIGIN: apiOrigin,
    DEMO_HUMAN_AUTH: "true",
    DEMO_HUMAN_USER_ID: demoUserId,
    CAPYN_EXECUTION_MODE: "remote-gate",
    CAPYN_EXECUTION_GATE_URL: gateOrigin,
    CAPYN_EXECUTION_GATE_CONTROL_TOKEN: controlToken,
    CAPYN_EXECUTION_GATE_ID: gateId,
    CAPYN_EXECUTION_PROVIDER_NAME: providerName,
    CAPYN_EXECUTION_ISSUER: issuer,
    CAPYN_EXECUTION_AUDIENCE: audience,
    CAPYN_EXECUTION_KEY_ID: keyId,
    CAPYN_EXECUTION_PRIVATE_KEY_B64: Buffer.from(privateKey).toString("base64"),
    CAPYN_EXECUTION_GATE_RECEIPT_VERIFY_SECRET_B64: Buffer.from(receiptSecret).toString("base64")
  };
  launch("api", [resolve(root, "apps/api/dist/index.js")], apiEnvironment);
  await waitFor(apiOrigin, "/health");
  report = await smokeApi();
} catch (error) {
  for (const child of children) {
    process.stderr.write(`\n${child.name} output:\n${child.output.join("").slice(-8_000)}\n`);
  }
  throw error;
} finally {
  await stopChildren();
}

process.stdout.write(`remote-gate-smoke · ${JSON.stringify({ ...report, gate: gateId, api: apiOrigin, gateOrigin })}\n`);
