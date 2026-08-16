import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import process from "node:process";

const dashboardUrl = process.env.CAPYN_SCREENSHOT_URL ?? "http://localhost:3010/dashboard/authorizations";
const rowSelector = process.env.CAPYN_SCREENSHOT_SELECTOR ?? "tbody tr:nth-child(2)";
const outputPath = resolve(process.argv[2] ?? "outreach/screenshots/capyn-authorization-trace.png");

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser"
].filter(Boolean);

const chromePath = chromeCandidates.find((candidate) => existsSync(candidate));
if (!chromePath) {
  throw new Error("Chrome was not found. Set CHROME_PATH to a Chromium-compatible browser executable.");
}

const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
const profileDirectory = mkdtempSync(join(tmpdir(), "capyn-media-"));
const resolvedTempRoot = resolve(tmpdir());
const resolvedProfile = resolve(profileDirectory);

if (!resolvedProfile.startsWith(`${resolvedTempRoot}${sep}`)) {
  throw new Error("Refusing to use a browser profile outside the system temporary directory.");
}

const browser = spawn(
  chromePath,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--window-size=1600,1000",
    "--force-device-scale-factor=1",
    "--remote-debugging-port=0",
    `--user-data-dir=${profileDirectory}`,
    dashboardUrl
  ],
  { stdio: ["ignore", "ignore", "pipe"], windowsHide: true }
);

let socket;

try {
  const debuggerAddress = await new Promise((resolveAddress, rejectAddress) => {
    let diagnostic = "";
    const timeout = setTimeout(() => rejectAddress(new Error(`Chrome did not expose DevTools in time. ${diagnostic}`)), 15_000);

    browser.stderr.setEncoding("utf8");
    browser.stderr.on("data", (chunk) => {
      diagnostic = `${diagnostic}${chunk}`.slice(-2_000);
      const match = diagnostic.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match?.[1]) {
        clearTimeout(timeout);
        resolveAddress(match[1]);
      }
    });
    browser.once("error", (error) => {
      clearTimeout(timeout);
      rejectAddress(error);
    });
    browser.once("exit", (code) => {
      clearTimeout(timeout);
      rejectAddress(new Error(`Chrome exited before capture with code ${code}. ${diagnostic}`));
    });
  });

  const debuggerUrl = new URL(debuggerAddress);
  const targetsUrl = `http://127.0.0.1:${debuggerUrl.port}/json/list`;
  let page;

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const targets = await fetch(targetsUrl).then((response) => response.json());
    page = targets.find((target) => target.type === "page" && target.url.includes("/dashboard/authorizations"));
    if (page) break;
    await delay(100);
  }

  if (!page) throw new Error(`No dashboard page target was found for ${dashboardUrl}.`);

  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolveSocket, rejectSocket) => {
    socket.addEventListener("open", resolveSocket, { once: true });
    socket.addEventListener("error", rejectSocket, { once: true });
  });

  let nextId = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const handler = pending.get(message.id);
    if (!handler) return;
    pending.delete(message.id);
    if (message.error) handler.reject(new Error(message.error.message));
    else handler.resolve(message.result);
  });

  const call = (method, params = {}) => new Promise((resolveCall, rejectCall) => {
    const id = ++nextId;
    pending.set(id, { resolve: resolveCall, reject: rejectCall });
    socket.send(JSON.stringify({ id, method, params }));
  });

  await delay(2_000);
  const clickResult = await call("Runtime.evaluate", {
    expression: `(() => { const row = document.querySelector(${JSON.stringify(rowSelector)}); if (!row) return false; row.click(); return true; })()`,
    returnByValue: true
  });

  if (clickResult.result?.value !== true) {
    throw new Error(`Dashboard row ${rowSelector} was not available. Seed the four demo authorizations first.`);
  }

  await delay(400);
  const capture = await call("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false
  });

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, Buffer.from(capture.data, "base64"));
  process.stdout.write(`CAPYN dashboard evidence saved to ${outputPath}\n`);
} finally {
  socket?.close();
  browser.kill();
  await delay(500);
  rmSync(resolvedProfile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}
