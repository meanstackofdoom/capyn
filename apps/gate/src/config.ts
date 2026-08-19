import { createHash } from "node:crypto";
import { z } from "zod";
import { awsEc2DryRunBlueprintSchema } from "./providers/aws-ec2-dry-run";

const integerString = (minimum: number, maximum: number) => z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().min(minimum).max(maximum));

const base64Schema = z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/).min(4);

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: integerString(1, 65_535).default("4100"),
    HOST: z.string().default("0.0.0.0"),
    DATABASE_URL: z.string().optional(),
    GATE_REPLAY_STORAGE: z.enum(["postgres", "memory"]).default("postgres"),
    GATE_CONTROL_TOKEN: z.string().min(32),
    GATE_ID: z.string().trim().min(1).max(240),
    GATE_EXPECTED_ISSUER: z.string().trim().min(1).max(240),
    GATE_AUDIENCE: z.string().trim().min(1).max(240),
    GATE_PUBLIC_KEYS_B64: base64Schema,
    GATE_RECEIPT_SIGNING_SECRET_B64: base64Schema.optional(),
    GATE_ALLOWED_CLOCK_SKEW_SECONDS: integerString(0, 60).default("5"),
    GATE_MAX_CLAIM_TTL_SECONDS: integerString(1, 300).default("60"),
    AWS_SANDBOX_BLUEPRINTS_B64: base64Schema
  })
  .superRefine((value, context) => {
    if (value.GATE_REPLAY_STORAGE === "postgres" && !value.DATABASE_URL) {
      context.addIssue({ code: "custom", path: ["DATABASE_URL"], message: "DATABASE_URL is required" });
    }
    if (value.NODE_ENV === "production" && value.GATE_REPLAY_STORAGE !== "postgres") {
      context.addIssue({
        code: "custom",
        path: ["GATE_REPLAY_STORAGE"],
        message: "Production Gate requires PostgreSQL replay storage"
      });
    }
  });

function decodeJson(value: string, label: string): unknown {
  try {
    return JSON.parse(Buffer.from(value, "base64").toString("utf8"));
  } catch {
    throw new Error(`Invalid CAPYN Gate configuration: ${label} must contain base64-encoded JSON`);
  }
}

function decodeReceiptSigningSecret(value: string | undefined): Buffer | undefined {
  if (!value) return undefined;
  const decoded = Buffer.from(value, "base64");
  if (decoded.length < 16) {
    throw new Error("Invalid CAPYN Gate configuration: GATE_RECEIPT_SIGNING_SECRET_B64 must decode to at least 16 bytes");
  }
  return decoded;
}

const publicKeysSchema = z.record(z.string().trim().min(1), z.string().min(64)).refine(
  (keys) => Object.keys(keys).length > 0,
  "At least one Gate public key is required"
);

const blueprintsSchema = z.array(awsEc2DryRunBlueprintSchema).min(1).max(20);

export function loadGateConfig(environment: NodeJS.ProcessEnv = process.env) {
  const parsed = environmentSchema.safeParse(environment);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid CAPYN Gate configuration: ${message}`);
  }
  const publicKeys = publicKeysSchema.safeParse(decodeJson(parsed.data.GATE_PUBLIC_KEYS_B64, "GATE_PUBLIC_KEYS_B64"));
  if (!publicKeys.success) {
    throw new Error(`Invalid CAPYN Gate configuration: GATE_PUBLIC_KEYS_B64: ${publicKeys.error.issues[0]?.message}`);
  }
  const blueprints = blueprintsSchema.safeParse(
    decodeJson(parsed.data.AWS_SANDBOX_BLUEPRINTS_B64, "AWS_SANDBOX_BLUEPRINTS_B64")
  );
  if (!blueprints.success) {
    throw new Error(`Invalid CAPYN Gate configuration: AWS_SANDBOX_BLUEPRINTS_B64: ${blueprints.error.issues[0]?.message}`);
  }
  return {
    ...parsed.data,
    publicKeys: publicKeys.data,
    blueprints: blueprints.data,
    receiptSigningSecret: decodeReceiptSigningSecret(parsed.data.GATE_RECEIPT_SIGNING_SECRET_B64),
    replayNamespace: createHash("sha256")
      .update(JSON.stringify({
        issuer: parsed.data.GATE_EXPECTED_ISSUER,
        audience: parsed.data.GATE_AUDIENCE,
        gateId: parsed.data.GATE_ID
      }), "utf8")
      .digest("hex")
  };
}
