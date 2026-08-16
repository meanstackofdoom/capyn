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
    CAPYN_STORAGE: z.enum(["postgres", "memory"]).default("postgres"),
    DATABASE_URL: z.string().optional(),
    API_KEY_PEPPER: z.string().min(32),
    WEB_ORIGIN: z.string().url().default("http://localhost:3010"),
    DEMO_HUMAN_AUTH: booleanString,
    BOOTSTRAP_TOKEN: z.string().min(24).optional()
  })
  .superRefine((value, context) => {
    if (value.CAPYN_STORAGE === "postgres" && !value.DATABASE_URL) {
      context.addIssue({ code: "custom", path: ["DATABASE_URL"], message: "DATABASE_URL is required" });
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
