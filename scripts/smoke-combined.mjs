import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dirname, "..");
const externalPort = 3120;
const apiPort = 4120;
const webPort = 3121;
const origin = `http://127.0.0.1:${externalPort}`;
const agentApiKey = "capyn_demo_N7m2kQ4xR8vB3pL6sT9wY1cF5hJ0dG2a";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

async function portAvailable(port) {
  await new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", () => reject(new Error(`Port ${port} is already in use`)));
    server.listen(port, "127.0.0.1", () => server.close(resolvePort));
  });
}

await Promise.all([externalPort, apiPort, webPort].map(portAvailable));
const output = [];
const child = spawn(process.execPath, [resolve(root, "scripts/start-service.mjs")], {
  cwd: root,
  windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env,
    NODE_ENV: "production",
    CAPYN_SERVICE: "combined",
    PORT: String(externalPort),
    CAPYN_INTERNAL_API_PORT: String(apiPort),
    CAPYN_INTERNAL_WEB_PORT: String(webPort),
    CAPYN_STORAGE: "memory",
    API_KEY_PEPPER: "capyn-combined-smoke-pepper-2026-do-not-use-live",
    WEB_ORIGIN: origin,
    NEXT_PUBLIC_SITE_URL: origin,
    NEXT_PUBLIC_API_URL: origin,
    PROJECT_STATUS_PASSWORD: "capyn-private-status-combined-smoke-password",
    PROJECT_STATUS_SESSION_SECRET: "capyn-private-status-combined-smoke-session-secret",
    PROJECT_STATUS_CONTENT_B64: Buffer.from(
      "# Project status\n\n## Required before real money\n\nPrivate combined-smoke record."
    ).toString("base64"),
    DEMO_HUMAN_AUTH: "true",
    DEMO_HUMAN_USER_ID: "usr_demo_owner",
    TRUST_PROXY: "false"
  }
});
const capture = (chunk) => output.push(String(chunk));
child.stdout.on("data", capture);
child.stderr.on("data", capture);

async function waitFor(path) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${origin}${path}`, { signal: AbortSignal.timeout(1_500) });
      if (response.ok) return response;
    } catch {
      // Wait for the combined service and its two children.
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${path}`);
}

try {
  const [apiHealth, webHealth] = await Promise.all([waitFor("/health"), waitFor("/healthz")]);
  assert((await apiHealth.json()).service === "capyn-api", "Combined API route is invalid");
  assert((await webHealth.json()).service === "capyn-web", "Combined web route is invalid");

  const home = await fetch(`${origin}/`);
  const homeHtml = await home.text();
  assert(
    homeHtml.includes("Not unlimited access") && homeHtml.includes("Live policy boundary"),
    "Combined public website is invalid"
  );
  assert(home.headers.get("content-security-policy")?.includes("frame-ancestors 'none'"), "Combined CSP is missing");

  const privateGate = await fetch(`${origin}/private/project-status`);
  const privateGateHtml = await privateGate.text();
  assert(privateGateHtml.includes("Unlock status ledger"), "Combined private status gate is missing");
  assert(!privateGateHtml.includes("Required before real money"), "Combined private status leaked before login");

  const privateLogin = await fetch(`${origin}/private/project-status/session`, {
    method: "POST",
    body: new URLSearchParams({ password: "capyn-private-status-combined-smoke-password" }),
    redirect: "manual"
  });
  assert(privateLogin.status === 303, `Combined private login returned ${privateLogin.status}`);
  const privateLocation = privateLogin.headers.get("location");
  assert(privateLocation && new URL(privateLocation, origin).origin === origin, "Combined private login exposed an internal redirect");
  const privateCookie = privateLogin.headers.get("set-cookie")?.split(";", 1)[0];
  assert(privateCookie, "Combined private login did not issue a session cookie");
  const privateRecord = await fetch(new URL(privateLocation, origin), { headers: { Cookie: privateCookie } });
  const privateRecordHtml = await privateRecord.text();
  assert(privateRecordHtml.includes("Required before real money"), "Combined private record did not load after login");

  const me = await fetch(`${origin}/v1/me`, { headers: { Authorization: `Bearer ${agentApiKey}` } });
  assert(me.ok && (await me.json()).name === "procurement-agent", "Combined agent route is invalid");
  process.stdout.write(`combined-smoke · ${JSON.stringify({ origin, api: "ok", web: "ok", proxy: "ok", privateStatus: "ok" })}\n`);
} catch (error) {
  process.stderr.write(`${output.join("").slice(-8_000)}\n`);
  throw error;
} finally {
  if (child.exitCode === null) child.kill("SIGTERM");
  await Promise.race([new Promise((resolveExit) => child.once("exit", resolveExit)), delay(5_000)]);
  if (child.exitCode === null) child.kill("SIGKILL");
}
