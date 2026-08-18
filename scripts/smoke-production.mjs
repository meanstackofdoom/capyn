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

  const labEvaluation = await request(`${apiOrigin}/v1/lab/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      capability: "spend.compute",
      amount: { value: "120.00", currency: "USD" },
      vendor: { id: "aws", name: "AWS" },
      purpose: "Separated-service smoke approval boundary"
    })
  }, 202);
  const labDecision = await labEvaluation.json();
  assert(labDecision.mode === "SYNTHETIC" && labDecision.decision === "REQUIRE_APPROVAL", "Authority Lab did not reach its human boundary");
  const labApproval = await request(`${apiOrigin}/v1/lab/approvals/${labDecision.approval.id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision: "APPROVE" })
  });
  const labResolution = await labApproval.json();
  assert(labResolution.resolution === "APPROVED" && labResolution.outcome === "SIMULATED_EXECUTION", "Authority Lab approval did not resolve safely");

  const sandboxInput = {
    organisation: { name: "Production Smoke Works" },
    agent: { name: "Smoke evaluation agent", slug: "smoke-evaluation-agent" },
    mandate: {
      name: "Smoke compute authority",
      capabilities: ["spend.compute"],
      allowedVendors: [{ id: "openai", name: "OpenAI" }],
      limits: {
        approvalAbove: { value: "100.00", currency: "USD" },
        perTransaction: { value: "150.00", currency: "USD" },
        daily: { value: "200.00", currency: "USD" },
        monthly: { value: "2000.00", currency: "USD" }
      }
    },
    firstRequest: {
      capability: "spend.compute",
      amount: { value: "18.00", currency: "USD" },
      vendor: { id: "openai", name: "OpenAI" },
      purpose: "Production smoke sandbox commissioning"
    }
  };
  const sandboxActivationResponse = await request(`${apiOrigin}/v1/sandbox/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sandboxInput)
  }, 201);
  const sandboxActivation = await sandboxActivationResponse.json();
  assert(
    sandboxActivation.scope === "STATELESS_SANDBOX" && sandboxActivation.credential?.apiKey?.startsWith("capyn_sbx_"),
    "Sandbox activation did not issue a bounded credential"
  );
  const sandboxAuthorizationResponse = await request(`${apiOrigin}/v1/sandbox/authorize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sandboxActivation.credential.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(sandboxInput.firstRequest)
  });
  const sandboxAuthorization = await sandboxAuthorizationResponse.json();
  assert(
    sandboxAuthorization.decision === "ALLOW" &&
      sandboxAuthorization.agent?.slug === "smoke-evaluation-agent" &&
      /^[a-f0-9]{64}$/.test(sandboxAuthorization.evidence?.digest ?? ""),
    "Sandbox credential did not authenticate a digest-covered first decision"
  );

  const onboardingBody = {
    organisation: { slug: "production-smoke-works" },
    owner: { name: "Production Smoke Owner", email: "owner@production-smoke.test" },
    planIntent: "DEVELOPER",
    acknowledgements: { keyCustody: true, syntheticExecution: true }
  };
  const onboardingResponse = await request(`${apiOrigin}/v1/onboarding/launch`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sandboxActivation.credential.apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": "production-smoke-launch-0001"
    },
    body: JSON.stringify(onboardingBody)
  }, 201);
  const onboarding = await onboardingResponse.json();
  assert(
    onboarding.scope === "DURABLE_WORKSPACE" &&
      onboarding.workspace?.persistence === "PROCESS_MEMORY" &&
      onboarding.credentials?.owner?.apiKey?.startsWith("capyn_owner_live_") &&
      onboarding.credentials?.agent?.apiKey?.startsWith("capyn_live_"),
    "Sandbox proof did not produce separated workspace credentials"
  );
  const onboardingReplay = await (await request(`${apiOrigin}/v1/onboarding/launch`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sandboxActivation.credential.apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": "production-smoke-launch-0001"
    },
    body: JSON.stringify(onboardingBody)
  })).json();
  assert(onboardingReplay.replayed === true && onboardingReplay.credentials.owner.apiKey === onboarding.credentials.owner.apiKey, "Onboarding replay did not recover the exact owner key");
  const ownerDashboard = await (await request(`${apiOrigin}/v1/dashboard`, {
    headers: { Authorization: `Bearer ${onboarding.credentials.owner.apiKey}` }
  })).json();
  assert(ownerDashboard.organisation.id === onboarding.workspace.id && ownerDashboard.operator.role === "OWNER", "Owner key did not resolve its tenant dashboard");
  const importedAgent = await (await request(`${apiOrigin}/v1/me`, {
    headers: { Authorization: `Bearer ${onboarding.credentials.agent.apiKey}` }
  })).json();
  assert(importedAgent.id === onboarding.agent.id && importedAgent.organisationId === onboarding.workspace.id, "Imported agent key did not resolve its durable identity");

  const billing = await (await request(`${apiOrigin}/v1/billing`, {
    headers: { "x-capyn-user-id": demoUserId }
  })).json();
  assert(billing.planId === "DEVELOPER", "Demo billing account is not on Developer");
  assert(billing.usage.some((line) => line.metric === "AUTHORIZATION_DECISION" && line.used === 4), "Decision usage was not recorded exactly once");

  return { decisions: [allow.decision, unknown.decision, approval.decision, transfer.decision], execution: execution.status, authorityLab: labResolution.resolution, sandbox: sandboxAuthorization.decision, onboarding: onboarding.workspace.persistence };
}

async function smokeWeb() {
  const catalog = JSON.parse(await readFile(resolve(root, "docs/catalog.json"), "utf8"));
  const publicCatalog = catalog.filter((document) => document.slug !== "project-status");
  const publicRoutes = [
    "/",
    "/activate",
    "/lab",
    "/proof",
    "/start",
    "/passport",
    "/design-partners",
    "/design-partners/brief",
    "/case-studies/procurement-agent",
    "/product",
    "/security",
    "/developers",
    "/pricing",
    "/docs",
    "/about",
    ...publicCatalog.map((document) => `/docs/${document.slug}`)
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

  const lab = await request(`${webOrigin}/lab`);
  const labHtml = await lab.text();
  assert(labHtml.includes("Try to cross") && labHtml.includes("Run the decision"), "Authority Lab instrument is missing");

  const activation = await request(`${webOrigin}/activate`);
  const activationHtml = await activation.text();
  assert(
    activationHtml.includes("Commission an agent") && activationHtml.includes("LIVE ARTIFACT REGISTER") && activationHtml.includes("Credential lives in this tab only"),
    "Sandbox commissioning bay is missing"
  );

  const designPartners = await request(`${webOrigin}/design-partners`);
  const designPartnersHtml = await designPartners.text();
  assert(
    designPartnersHtml.includes("Bring one real") && designPartnersHtml.includes("Draft a private brief") && designPartnersHtml.includes("GitHub route remains public"),
    "Design partner conversion path is missing"
  );

  const privateBrief = await request(`${webOrigin}/design-partners/brief`);
  const privateBriefHtml = await privateBrief.text();
  assert(
    privateBriefHtml.includes("Make the first conversation useful") &&
      privateBriefHtml.includes("Nothing here is uploaded") &&
      privateBriefHtml.includes("CAPYN / BOUNDARY BRIEF") &&
      privateBriefHtml.includes("OWNER ADDRESS / NOT PUBLISHED"),
    "Browser-local boundary brief is incomplete or overclaims its transfer state"
  );

  const passport = await request(`${webOrigin}/passport`);
  const passportHtml = await passport.text();
  assert(
    passportHtml.includes("Authority that can travel") && passportHtml.includes("payload stays in the URL fragment"),
    "Authority Passport verifier boundary is missing"
  );

  const proof = await request(`${webOrigin}/proof`);
  const proofHtml = await proof.text();
  assert(proofHtml.includes("One decision") && proofHtml.includes("proof travels in the URL fragment"), "Decision Proof Viewer boundary is missing");

  const robots = await (await request(`${webOrigin}/robots.txt`)).text();
  assert(robots.includes("Disallow: /dashboard/"), "robots.txt does not exclude the control plane");
  const sitemap = await (await request(`${webOrigin}/sitemap.xml`)).text();
  assert(
    sitemap.includes(`${canonicalOrigin}/pricing`) &&
      sitemap.includes(`${canonicalOrigin}/activate`) &&
      sitemap.includes(`${canonicalOrigin}/passport`) &&
      sitemap.includes(`${canonicalOrigin}/design-partners/brief`) &&
      sitemap.includes(`${canonicalOrigin}/docs/package-publishing`),
    "sitemap is incomplete"
  );
  assert(!sitemap.includes("/dashboard"), "sitemap exposes noindex dashboard routes");
  assert(!sitemap.includes("project-status"), "sitemap exposes the private project status");
  assert(robots.includes("Disallow: /private/"), "robots.txt does not exclude private routes");

  await request(`${webOrigin}/docs/project-status`, {}, 404);
  const privateGate = await request(`${webOrigin}/private/project-status`);
  const privateGateHtml = await privateGate.text();
  assert(privateGateHtml.includes("Unlock status ledger"), "Private status gate is missing");
  assert(!privateGateHtml.includes("Required before real money"), "Private status content leaked before authentication");
  assert(privateGate.headers.get("cache-control")?.includes("no-store"), "Private status route may be cached");
  assert(privateGate.headers.get("x-robots-tag")?.includes("noindex"), "Private status route is missing noindex headers");

  const login = await fetch(`${webOrigin}/private/project-status/session`, {
    method: "POST",
    body: new URLSearchParams({ password: "capyn-private-status-smoke-password" }),
    redirect: "manual",
    signal: AbortSignal.timeout(5_000)
  });
  assert(login.status === 303, `Private status login returned ${login.status}`);
  const sessionCookie = login.headers.get("set-cookie")?.split(";", 1)[0];
  assert(sessionCookie, "Private status login did not issue a session cookie");
  const privateRecord = await request(`${webOrigin}/private/project-status`, { headers: { Cookie: sessionCookie } });
  const privateRecordHtml = await privateRecord.text();
  assert(privateRecordHtml.includes("Required before real money"), "Authenticated status record is incomplete");
  assert(privateRecordHtml.includes("Private record open"), "Authenticated status state is missing");
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
    DEMO_HUMAN_AUTH: "true",
    DEMO_HUMAN_USER_ID: demoUserId
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
    {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(webPort),
      PROJECT_STATUS_PASSWORD: "capyn-private-status-smoke-password",
      PROJECT_STATUS_SESSION_SECRET: "capyn-private-status-smoke-session-secret-with-entropy",
      PROJECT_STATUS_CONTENT_B64: Buffer.from(
        "# Project status\n\n## Required before real money\n\nPrivate smoke-test record."
      ).toString("base64")
    }
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
