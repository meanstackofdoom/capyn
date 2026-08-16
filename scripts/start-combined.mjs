import { spawn } from "node:child_process";
import { request as httpRequest, createServer } from "node:http";
import { resolve } from "node:path";
import process from "node:process";

const repositoryRoot = resolve(import.meta.dirname, "..");
const externalPort = Number(process.env.PORT ?? 8080);
const apiPort = Number(process.env.CAPYN_INTERNAL_API_PORT ?? 4100);
const webPort = Number(process.env.CAPYN_INTERNAL_WEB_PORT ?? 3100);
const host = "127.0.0.1";
const publicOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? `http://localhost:${externalPort}`;
const children = [];
let stopping = false;
let proxyServer;

function validPort(value) {
  return Number.isInteger(value) && value > 0 && value <= 65_535;
}

if (![externalPort, apiPort, webPort].every(validPort) || new Set([externalPort, apiPort, webPort]).size !== 3) {
  throw new Error("Combined service ports must be three distinct valid TCP ports");
}

function launch(name, args, environment) {
  const child = spawn(process.execPath, args, {
    cwd: repositoryRoot,
    env: environment,
    windowsHide: true,
    stdio: "inherit"
  });
  children.push(child);
  child.once("exit", (code, signal) => {
    if (stopping) return;
    process.stderr.write(`CAPYN ${name} exited unexpectedly (${signal ?? code ?? "unknown"})\n`);
    void shutdown(1);
  });
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

async function waitFor(port, path) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(`http://${host}:${port}${path}`, { signal: AbortSignal.timeout(1_500) });
      if (response.ok) return;
    } catch {
      // Child processes need a short warm-up before the proxy accepts traffic.
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for internal service on port ${port}`);
}

launch("API", [resolve(repositoryRoot, "apps/api/dist/index.js")], {
  ...process.env,
  PORT: String(apiPort),
  HOST: host,
  WEB_ORIGIN: publicOrigin
});
launch(
  "web",
  [
    resolve(repositoryRoot, "apps/web/node_modules/next/dist/bin/next"),
    "start",
    resolve(repositoryRoot, "apps/web"),
    "-p",
    String(webPort),
    "-H",
    host
  ],
  { ...process.env, PORT: String(webPort) }
);

await Promise.all([waitFor(apiPort, "/health"), waitFor(webPort, "/healthz")]);

proxyServer = createServer((incoming, outgoing) => {
  const path = incoming.url ?? "/";
  const apiRequest = path === "/health" || path.startsWith("/v1/");
  const targetPort = apiRequest ? apiPort : webPort;
  const forwardedFor = [incoming.headers["x-forwarded-for"], incoming.socket.remoteAddress]
    .filter(Boolean)
    .join(", ");
  const proxy = httpRequest(
    {
      hostname: host,
      port: targetPort,
      path,
      method: incoming.method,
      headers: {
        ...incoming.headers,
        host: `${host}:${targetPort}`,
        "x-forwarded-host": incoming.headers.host ?? "",
        "x-forwarded-proto": incoming.headers["x-forwarded-proto"] ?? "http",
        "x-forwarded-for": forwardedFor
      }
    },
    (response) => {
      outgoing.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(outgoing);
    }
  );
  proxy.once("error", () => {
    if (!outgoing.headersSent) {
      outgoing.writeHead(503, { "content-type": "application/json; charset=utf-8" });
    }
    outgoing.end(JSON.stringify({ error: { code: "SERVICE_UNAVAILABLE", message: "CAPYN service unavailable" } }));
  });
  incoming.pipe(proxy);
});

async function shutdown(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  if (proxyServer?.listening) {
    await new Promise((resolveClose) => proxyServer.close(resolveClose));
  }
  for (const child of children) {
    if (child.exitCode === null) child.kill("SIGTERM");
  }
  await Promise.race([
    Promise.all(children.map((child) => child.exitCode === null
      ? new Promise((resolveExit) => child.once("exit", resolveExit))
      : Promise.resolve())),
    delay(5_000)
  ]);
  for (const child of children) {
    if (child.exitCode === null) child.kill("SIGKILL");
  }
  process.exitCode = exitCode;
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());

proxyServer.listen(externalPort, "0.0.0.0", () => {
  process.stdout.write(`CAPYN combined public-alpha service listening on ${externalPort}\n`);
});
