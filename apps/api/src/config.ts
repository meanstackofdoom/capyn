import { z } from "zod";

const booleanString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const base64Schema = z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/).min(4);

const configSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    HOST: z.string().default("0.0.0.0"),
    TRUST_PROXY: booleanString,
    CAPYN_STORAGE: z.enum(["postgres", "volume", "memory"]).default("postgres"),
    DATABASE_URL: z.string().optional(),
    CAPYN_VOLUME_PATH: z.string().trim().min(1).optional(),
    API_KEY_PEPPER: z.string().min(32),
    WEB_ORIGIN: z.string().url().default("http://localhost:3010"),
    DEMO_HUMAN_AUTH: booleanString,
    DEMO_HUMAN_USER_ID: z.string().trim().min(1).optional(),
    BOOTSTRAP_TOKEN: z.string().min(24).optional(),
    CAPYN_EXECUTION_MODE: z.enum(["local-mock", "remote-gate"]).default("local-mock"),
    CAPYN_EXECUTION_GATE_URL: z.string().url().optional(),
    CAPYN_EXECUTION_GATE_CONTROL_TOKEN: z.string().min(32).optional(),
    CAPYN_EXECUTION_GATE_ID: z.string().trim().min(1).max(240).optional(),
    CAPYN_EXECUTION_PROVIDER_NAME: z.string().trim().min(1).max(240).optional(),
    CAPYN_EXECUTION_ISSUER: z.string().trim().min(1).max(240).optional(),
    CAPYN_EXECUTION_AUDIENCE: z.string().trim().min(1).max(240).optional(),
    CAPYN_EXECUTION_KEY_ID: z.string().trim().min(1).max(240).optional(),
    CAPYN_EXECUTION_PRIVATE_KEY_B64: base64Schema.optional(),
    CAPYN_EXECUTION_CLAIM_TTL_SECONDS: z.coerce.number().int().min(1).max(300).default(30),
    CAPYN_EXECUTION_GATE_TIMEOUT_MS: z.coerce.number().int().min(100).max(120_000).default(10_000),
    STRIPE_SECRET_KEY: z.string().startsWith("sk_").optional(),
    STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
    STRIPE_PRICE_TEAM_MONTHLY: z.string().startsWith("price_").optional(),
    STRIPE_PRICE_BUSINESS_MONTHLY: z.string().startsWith("price_").optional()
  })
  .superRefine((value, context) => {
    if (value.CAPYN_STORAGE === "postgres" && !value.DATABASE_URL) {
      context.addIssue({ code: "custom", path: ["DATABASE_URL"], message: "DATABASE_URL is required" });
    }
    if (value.CAPYN_STORAGE === "volume" && !value.CAPYN_VOLUME_PATH) {
      context.addIssue({ code: "custom", path: ["CAPYN_VOLUME_PATH"], message: "CAPYN_VOLUME_PATH is required" });
    }
    if (value.DEMO_HUMAN_USER_ID && !value.DEMO_HUMAN_AUTH) {
      context.addIssue({
        code: "custom",
        path: ["DEMO_HUMAN_USER_ID"],
        message: "DEMO_HUMAN_AUTH must be enabled when a demo human user is configured"
      });
    }
    if (value.NODE_ENV === "production" && value.DEMO_HUMAN_AUTH && !value.DEMO_HUMAN_USER_ID) {
      context.addIssue({
        code: "custom",
        path: ["DEMO_HUMAN_USER_ID"],
        message: "A production demo must pin the human adapter to one explicit user"
      });
    }
    const remoteGateValues = [
      value.CAPYN_EXECUTION_GATE_URL,
      value.CAPYN_EXECUTION_GATE_CONTROL_TOKEN,
      value.CAPYN_EXECUTION_GATE_ID,
      value.CAPYN_EXECUTION_PROVIDER_NAME,
      value.CAPYN_EXECUTION_ISSUER,
      value.CAPYN_EXECUTION_AUDIENCE,
      value.CAPYN_EXECUTION_KEY_ID,
      value.CAPYN_EXECUTION_PRIVATE_KEY_B64
    ];
    if (value.CAPYN_EXECUTION_MODE === "remote-gate" && !remoteGateValues.every(Boolean)) {
      context.addIssue({
        code: "custom",
        path: ["CAPYN_EXECUTION_MODE"],
        message: "Remote Gate mode requires the complete execution Gate configuration"
      });
    }
    if (value.CAPYN_EXECUTION_MODE === "local-mock" && remoteGateValues.some(Boolean)) {
      context.addIssue({
        code: "custom",
        path: ["CAPYN_EXECUTION_MODE"],
        message: "Set CAPYN_EXECUTION_MODE=remote-gate when execution Gate variables are configured"
      });
    }
    const stripeValues = [
      value.STRIPE_SECRET_KEY,
      value.STRIPE_WEBHOOK_SECRET,
      value.STRIPE_PRICE_TEAM_MONTHLY,
      value.STRIPE_PRICE_BUSINESS_MONTHLY
    ];
    if (stripeValues.some(Boolean) && !stripeValues.every(Boolean)) {
      context.addIssue({
        code: "custom",
        path: ["STRIPE_SECRET_KEY"],
        message: "All Stripe billing variables must be configured together"
      });
    }
  });

export function loadConfig(environment: NodeJS.ProcessEnv = process.env) {
  const parsed = configSchema.safeParse(environment);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid CAPYN configuration: ${message}`);
  }
  return parsed.data;
}
