import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const apiPort = 4110;
const webPort = 3110;
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const webOrigin = `http://127.0.0.1:${webPort}`;
const agentApiKey = "capyn_demo_N7m2kQ4xR8vB3pL6sT9wY1cF5hJ0dG2a";
const demoUserId = "usr_demo_owner";
const children = [];

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

async function waitFor(url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
    } catch {
      // The process can take a moment to bind after spawning.
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
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

const baseRequest = {
  capability: "spend.compute",
  amount: { value: "18.00", currency: "USD" },
  vendor: { id: "openai", name: "OpenAI" },
  metadata: { purpose: "Production smoke test" }
};

async function smokeApi() {
  const health = await (await request(`${apiOrigin}/health`)).json();
  assert(health.status === "ok" && health.service === "capyn-api", "API health payload is invalid");

  const invalidKey = await request(`${apiOrigin}/v1/me`, {
    headers: { Authorization: "Bearer capyn_invalid" }
  }, 401);
  const invalidKeyBody = await invalidKey.json();
  assert(invalidKeyBody.error?.code === "UNAUTHENTICATED", "Invalid API key did not fail safely");

  const allow = await authorize("production-smoke-allow-0001", baseRequest);
  assert(allow.decision === "ALLOW", "Seeded OpenAI request was not allowed");

  const unknown = await authorize("production-smoke-unknown-0001", {
    ...baseRequest,
    amount: { value: "30.00", currency: "USD" },
    vendor: { id: "unknown", name: "UnknownVendor" }
  });
  assert(unknown.decision === "DENY" && unknown.reasonCodes.includes("VENDOR_NOT_ALLOWED"), "Unknown vendor did not fail closed");

  const approval = await authorize("production-smoke-approval-0001", {
    ...baseRequest,
    amount: { value: "120.00", currency: "USD" },
    vendor: { id: "aws", name: "AWS" }
  }, 202);
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
  assert(execution.status === "EXECUTED" && execution.provider === "mock", "Approved mock execution failed");

  const transfer = await authorize("production-smoke-transfer-0001", {
    ...baseRequest,
    capability: "transfer.wallet",
    amount: { value: "20.00", currency: "USD" }
  });
  assert(transfer.decision === "DENY" && transfer.reasonCodes.includes("CAPABILITY_NOT_GRANTED"), "Wallet transfer was not denied");

  const malformed = await request(`${apiOrigin}/v1/authorize`, {
    method: "POST",
    headers: agentHeaders("production-smoke-malformed-0001"),
    body: JSON.stringify({ ...baseRequest, agentId: "agt_impersonation" })
  }, 400);
  const malformedBody = await malformed.json();
  assert(malformedBody.error?.code === "VALIDATION_ERROR" && !JSON.stringify(malformedBody).includes("stack"), "Malformed input did not return a safe validation error");

  const billing = await (await request(`${apiOrigin}/v1/billing`, {
    headers: { "x-capyn-user-id": demoUserId }
  })).json();
  assert(billing.planId === "DEVELOPER", "Demo billing account is not on Developer");
  assert(billing.usage.some((line) => line.metric === "AUTHORIZATION_DECISION" && line.used === 4), "Decision usage was not recorded exactly once");

  return { decisions: [allow.decision, unknown.decision, approval.decision, transfer.decision], execution: execution.status };
}

async function smokeWeb() {
  const catalog = JSON.parse(await readFile(resolve(root, "docs/catalog.json"), "utf8"));
  const publicRoutes = [
    "/",
    "/product",
    "/security",
    "/developers",
    "/pricing",
    "/docs",
    "/about",
    ...catalog.map((document) => `/docs/${document.slug}`)
  ];
  const dashboardRoutes = [
    "/dashboard",
    "/dashboard/agents",
    "/dashboard/mandates",
    "/dashboard/authorizations",
    "/dashboard/approvals",
    "/dashboard/audit",
    "/dashboard/billing",
    "/dashboard/developers",
    "/dashboard/settings"
  ];
  let canonicalOrigin;

  for (const route of publicRoutes) {
    const response = await request(`${webOrigin}${route}`);
    const html = await response.text();
    assert(/<title>[^<]*CAPYN[^<]*<\/title>/.test(html), `${route} is missing a CAPYN title`);
    assert(/<meta name="description" content="[^"]+"/.test(html), `${route} is missing a description`);
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    assert(canonical, `${route} is missing a canonical URL`);
    if (route === "/") canonicalOrigin = new URL(canonical).origin;
    assert(canonicalOrigin, "Homepage canonical origin is missing");
    const expectedCanonical = new URL(route, `${canonicalOrigin}/`).href;
    assert(new URL(canonical).href === expectedCanonical, `${route} has an invalid canonical URL: ${canonical}`);
    assert(/<meta property="og:title" content="[^"]+"/.test(html), `${route} is missing Open Graph metadata`);
  }

  for (const route of dashboardRoutes) {
    const html = await (await request(`${webOrigin}${route}`)).text();
    assert(/<meta name="robots" content="noindex, nofollow"/.test(html), `${route} must be noindex`);
  }

  const home = await request(`${webOrigin}/`);
  const homeHtml = await home.text();
  assert(homeHtml.includes('"@type":"SoftwareApplication"'), "Homepage SoftwareApplication JSON-LD is missing");
  assert(home.headers.get("content-security-policy")?.includes("frame-ancestors 'none'"), "CSP is missing or incomplete");
  assert(home.headers.get("x-content-type-options") === "nosniff", "nosniff header is missing");
  assert(home.headers.get("x-frame-options") === "DENY", "frame denial header is missing");
  assert(home.headers.get("cross-origin-opener-policy") === "same-origin", "COOP header is missing");

  const robots = await (await request(`${webOrigin}/robots.txt`)).text();
  assert(robots.includes("Disallow: /dashboard/"), "robots.txt does not exclude the control plane");
  const sitemap = await (await request(`${webOrigin}/sitemap.xml`)).text();
  assert(sitemap.includes(`${canonicalOrigin}/pricing`) && sitemap.includes(`${canonicalOrigin}/docs/billing`), "sitemap is incomplete");
  assert(!sitemap.includes("/dashboard"), "sitemap exposes noindex dashboard routes");
  const manifest = await (await request(`${webOrigin}/manifest.webmanifest`)).json();
  assert(manifest.short_name === "CAPYN" && manifest.name?.startsWith("CAPYN"), "Web manifest is invalid");
  const socialImage = await request(`${webOrigin}/opengraph-image`);
  assert(socialImage.headers.get("content-type")?.startsWith("image/"), "Open Graph image is invalid");

  return { publicRoutes: publicRoutes.length, dashboardRoutes: dashboardRoutes.length };
}

let report;
try {
  await Promise.all([assertPortAvailable(apiPort), assertPortAvailable(webPort)]);
  const apiEnvironment = {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(apiPort),
    HOST: "127.0.0.1",
    TRUST_PROXY: "false",
    CAPYN_STORAGE: "memory",
    API_KEY_PEPPER: "capyn-production-smoke-pepper-2026-do-not-use-live",
    WEB_ORIGIN: webOrigin,
    DEMO_HUMAN_AUTH: "true"
  };
  launch("api", [resolve(root, "apps/api/dist/index.js")], apiEnvironment);
  launch(
    "web",
    [
      resolve(root, "apps/web/node_modules/next/dist/bin/next"),
      "start",
      resolve(root, "apps/web"),
      "-p",
      String(webPort),
      "-H",
      "127.0.0.1"
    ],
    { ...process.env, NODE_ENV: "production", PORT: String(webPort) }
  );
  await Promise.all([waitFor(`${apiOrigin}/health`), waitFor(`${webOrigin}/healthz`)]);
  const [api, web] = await Promise.all([smokeApi(), smokeWeb()]);
  report = { api, web, origins: { api: apiOrigin, web: webOrigin } };
} catch (error) {
  for (const child of children) {
    process.stderr.write(`\n${child.name} output:\n${child.output.join("").slice(-8_000)}\n`);
  }
  throw error;
} finally {
  await stopChildren();
}

process.stdout.write(`production-smoke · ${JSON.stringify(report)}\n`);
