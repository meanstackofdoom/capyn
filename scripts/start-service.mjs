import { spawn } from "node:child_process";
import process from "node:process";

const service = process.env.CAPYN_SERVICE;
if (service !== "api" && service !== "web" && service !== "gate" && service !== "combined") {
  process.stderr.write("CAPYN_SERVICE must be set to api, web, gate or combined\n");
  process.exit(1);
}

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function run(command, args, { forwardSignals = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: false });
    const forwardInterrupt = () => {
      if (forwardSignals && !child.killed) child.kill("SIGINT");
    };
    const forwardTerminate = () => {
      if (forwardSignals && !child.killed) child.kill("SIGTERM");
    };
    if (forwardSignals) {
      process.once("SIGINT", forwardInterrupt);
      process.once("SIGTERM", forwardTerminate);
    }
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (forwardSignals) {
        process.removeListener("SIGINT", forwardInterrupt);
        process.removeListener("SIGTERM", forwardTerminate);
      }
      if (signal) reject(new Error(`CAPYN ${service} stopped by ${signal}`));
      else resolve(code ?? 1);
    });
  });
}

const needsMigrations =
  ((service === "api" || service === "combined") &&
    process.env.CAPYN_STORAGE !== "memory" &&
    process.env.CAPYN_STORAGE !== "volume") ||
  (service === "gate" && process.env.GATE_REPLAY_STORAGE !== "memory");
if (needsMigrations) {
  const migrationCode = await run(pnpm, ["db:migrate"]);
  if (migrationCode !== 0) process.exit(migrationCode);
  if ((service === "api" || service === "combined") && process.env.CAPYN_SEED_DEMO === "true") {
    const seedCode = await run(pnpm, ["db:seed"]);
    if (seedCode !== 0) process.exit(seedCode);
  }
}

const exitCode = service === "combined"
  ? await run(process.execPath, ["scripts/start-combined.mjs"], { forwardSignals: true })
  : await run(
      pnpm,
      ["--filter", service === "api" ? "@capyn/api" : service === "gate" ? "@capyn/gate-service" : "@capyn/web", "start"],
      { forwardSignals: true }
    );
process.exit(exitCode);
