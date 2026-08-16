import { spawn } from "node:child_process";
import process from "node:process";

const service = process.env.CAPYN_SERVICE;
if (service !== "api" && service !== "web") {
  process.stderr.write("CAPYN_SERVICE must be set to api or web\n");
  process.exit(1);
}

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function run(args, { forwardSignals = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(pnpm, args, { stdio: "inherit", shell: false });
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

if (service === "api" && process.env.CAPYN_STORAGE === "postgres") {
  const migrationCode = await run(["db:migrate"]);
  if (migrationCode !== 0) process.exit(migrationCode);
}

const workspace = service === "api" ? "@capyn/api" : "@capyn/web";
const exitCode = await run(["--filter", workspace, "start"], { forwardSignals: true });
process.exit(exitCode);
