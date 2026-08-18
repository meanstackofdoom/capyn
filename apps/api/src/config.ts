import { z } from "zod";

const booleanString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

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
