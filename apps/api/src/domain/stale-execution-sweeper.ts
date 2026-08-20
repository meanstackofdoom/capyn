import type { ExecutionService, StaleExecutionSweepResult } from "./execution-service";

export const DEFAULT_STALE_SWEEP_LIMIT = 50;

export interface StaleExecutionSweeperConfig {
  executions: ExecutionService;
  intervalMs: number;
  limit?: number;
  logger?: {
    info: (message: string) => void;
    error: (message: string) => void;
  };
}

export class StaleExecutionSweeper {
  private readonly executions: ExecutionService;
  private readonly intervalMs: number;
  private readonly limit: number;
  private readonly logger: StaleExecutionSweeperConfig["logger"];
  private timer: NodeJS.Timeout | null = null;
  private stopped = false;

  constructor(config: StaleExecutionSweeperConfig) {
    if (!Number.isInteger(config.intervalMs) || config.intervalMs <= 0) {
      throw new Error("Stale execution sweep interval must be a positive integer");
    }
    const limit = config.limit ?? DEFAULT_STALE_SWEEP_LIMIT;
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new Error("Stale execution sweep limit must be a positive integer");
    }
    this.executions = config.executions;
    this.intervalMs = config.intervalMs;
    this.limit = limit;
    this.logger = config.logger;
  }

  start(): void {
    if (this.timer !== null || this.stopped) return;
    this.schedule();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  async runOnce(): Promise<StaleExecutionSweepResult> {
    return this.executions.sweepStaleExecutions(this.limit);
  }

  private schedule(): void {
    this.timer = setTimeout(() => {
      void this.tick();
    }, this.intervalMs);
    this.timer.unref?.();
  }

  private async tick(): Promise<void> {
    if (this.stopped) return;
    try {
      const result = await this.runOnce();
      if (result.candidates > 0) {
        this.logger?.info(
          `stale-execution-sweep · ${JSON.stringify(result)}`
        );
      }
    } catch (error) {
      this.logger?.error(`stale-execution-sweep failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (!this.stopped) this.schedule();
    }
  }
}
