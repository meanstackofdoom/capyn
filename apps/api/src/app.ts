import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import type { CapynRepository } from "@capyn/database";
import { ApprovalService } from "./domain/approval-service";
import { AuthorizationService } from "./domain/authorization-service";
import { DisabledBillingProvider, type BillingProvider } from "./domain/billing-provider";
import { BillingService } from "./domain/billing-service";
import { BootstrapService } from "./domain/bootstrap-service";
import {
  ExecutionService,
  type ExecutionAuthority
} from "./domain/execution-service";
import { LabService } from "./domain/lab-service";
import { ManagementService } from "./domain/management-service";
import { ProductionOnboardingService } from "./domain/production-onboarding-service";
import { SandboxService } from "./domain/sandbox-service";
import { RepositoryAuthAdapter } from "./http/auth";
import { AppError } from "./http/errors";
import { registerAgentRoutes } from "./routes/agent";
import { registerBillingRoutes } from "./routes/billing";
import { registerBootstrapRoutes } from "./routes/bootstrap";
import { registerLabRoutes } from "./routes/lab";
import { registerManagementRoutes } from "./routes/management";
import { registerOnboardingRoutes } from "./routes/onboarding";
import { registerSandboxRoutes } from "./routes/sandbox";

export interface AppDependencies {
  repository: CapynRepository;
  apiKeyPepper: string;
  allowDemoHumanHeader?: boolean;
  demoHumanUserId?: string;
  bootstrapToken?: string;
  webOrigin?: string;
  clock?: () => Date;
  executionAuthority?: ExecutionAuthority;
  billingProvider?: BillingProvider;
  logger?: boolean;
  disableRateLimit?: boolean;
  trustProxy?: boolean;
  onboardingPersistence?: "POSTGRESQL" | "VOLUME_JOURNAL" | "PROCESS_MEMORY";
}

export async function buildApp(dependencies: AppDependencies): Promise<FastifyInstance> {
  const app: FastifyInstance = Fastify({
    logger:
      dependencies.logger ??
      {
        level: process.env.LOG_LEVEL ?? "info",
        redact: {
          paths: [
            "req.headers.authorization",
            "req.headers.x-capyn-bootstrap-token",
            "req.headers.stripe-signature",
            "res.headers.set-cookie"
          ],
          censor: "[REDACTED]"
        }
      },
    bodyLimit: 32 * 1024,
    requestIdHeader: "x-request-id",
    trustProxy: dependencies.trustProxy ?? false
  });

  await app.register(helmet, {
    global: true,
    contentSecurityPolicy: false
  });
  await app.register(cors, {
    origin: dependencies.webOrigin ?? "http://localhost:3010",
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "Idempotency-Key",
      "x-capyn-bootstrap-token",
      "x-capyn-user-id",
      "x-request-id"
    ]
  });
  if (!dependencies.disableRateLimit) {
    await app.register(rateLimit, {
      max: 300,
      timeWindow: "1 minute",
      keyGenerator: (request) => request.ip,
      errorResponseBuilder: () => ({
        error: { code: "RATE_LIMITED", message: "Too many requests; retry later" }
      })
    });
  }

  const clock = dependencies.clock ?? (() => new Date());
  const auth = new RepositoryAuthAdapter(
    dependencies.repository,
    dependencies.apiKeyPepper,
    dependencies.allowDemoHumanHeader ?? false,
    dependencies.demoHumanUserId
  );
  const authorizations = new AuthorizationService(dependencies.repository, clock);
  const approvals = new ApprovalService(dependencies.repository, clock);
  const executions = new ExecutionService(
    dependencies.repository,
    dependencies.executionAuthority,
    clock
  );
  const management = new ManagementService(dependencies.repository, dependencies.apiKeyPepper, clock);
  const bootstrap = new BootstrapService(dependencies.repository, dependencies.bootstrapToken, clock);
  const billing = new BillingService(
    dependencies.repository,
    dependencies.billingProvider ?? new DisabledBillingProvider(),
    dependencies.webOrigin ?? "http://localhost:3010",
    clock
  );
  const lab = new LabService(clock);
  const sandbox = new SandboxService(dependencies.apiKeyPepper, clock);
  const onboarding = new ProductionOnboardingService(
    dependencies.repository,
    dependencies.apiKeyPepper,
    sandbox,
    billing,
    clock,
    dependencies.onboardingPersistence ?? "PROCESS_MEMORY"
  );

  app.get("/health", async () => ({ status: "ok", service: "capyn-api", version: "0.4.0" }));
  await registerLabRoutes(app, lab);
  await registerSandboxRoutes(app, sandbox);
  await registerOnboardingRoutes(app, onboarding);
  await registerAgentRoutes(app, { auth, authorizations, executions });
  await registerManagementRoutes(app, { auth, approvals, management });
  await registerBillingRoutes(app, { auth, billing });
  await registerBootstrapRoutes(app, bootstrap);

  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send({ error: { code: "NOT_FOUND", message: "Route not found" } })
  );
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          requestId: request.id,
          ...(error.details ? { details: error.details } : {})
        }
      });
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number" &&
      error.statusCode >= 400 &&
      error.statusCode < 500
    ) {
      return reply.code(error.statusCode).send({
        error: { code: "INVALID_REQUEST", message: "The request could not be parsed", requestId: request.id }
      });
    }
    request.log.error({ err: error }, "request failed");
    return reply.code(500).send({
      error: { code: "INTERNAL_ERROR", message: "The request could not be completed", requestId: request.id }
    });
  });

  return app;
}
