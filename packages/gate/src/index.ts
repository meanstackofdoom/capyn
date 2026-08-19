import {
  createHash,
  createPrivateKey,
  createPublicKey,
  createHmac,
  generateKeyPairSync,
  KeyObject,
  sign as cryptoSign,
  timingSafeEqual,
  verify as cryptoVerify
} from "node:crypto";
import { jsonValueSchema, type JsonValue } from "@capyn/types";
import { z } from "zod";

export const EXECUTION_CLAIM_TYPE = "capyn-execution+jwt";
export const EXECUTION_CLAIM_ALGORITHM = "ES256";
export const DEFAULT_EXECUTION_CLAIM_TTL_SECONDS = 30;
export const DEFAULT_EXECUTION_CLAIM_MAX_TTL_SECONDS = 60;
export const DEFAULT_REPLAY_RETENTION_SECONDS = 300;

const identifierSchema = z.string().trim().min(1).max(240);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const epochSecondsSchema = z.number().int().nonnegative();

export const executionActionSchema = z
  .object({
    capability: z.string().trim().min(3).max(100),
    amountMinor: z.string().regex(/^[1-9]\d{0,13}$/),
    currency: z.literal("USD"),
    vendor: z
      .object({
        id: z.string().trim().min(1).max(100),
        name: z.string().trim().min(1).max(160).nullable()
      })
      .strict(),
    metadata: z.record(jsonValueSchema)
  })
  .strict();

export interface ExecutionAction {
  capability: string;
  amountMinor: string;
  currency: "USD";
  vendor: { id: string; name: string | null };
  metadata: Record<string, JsonValue>;
}

export const EXECUTION_CLAIM_OPERATIONS = ["EXECUTE", "RECONCILE"] as const;
export type ExecutionClaimOperation = (typeof EXECUTION_CLAIM_OPERATIONS)[number];

export const executionClaimContextSchema = z
  .object({
    operation: z.enum(EXECUTION_CLAIM_OPERATIONS),
    organisationId: identifierSchema,
    agentId: identifierSchema,
    mandateId: identifierSchema,
    authorizationId: identifierSchema,
    executionId: identifierSchema,
    attempt: z.number().int().positive(),
    action: executionActionSchema
  })
  .strict();

export interface ExecutionClaimContext {
  operation: ExecutionClaimOperation;
  organisationId: string;
  agentId: string;
  mandateId: string;
  authorizationId: string;
  executionId: string;
  attempt: number;
  action: ExecutionAction;
}

export const executionClaimHeaderSchema = z
  .object({
    alg: z.literal(EXECUTION_CLAIM_ALGORITHM),
    kid: identifierSchema,
    typ: z.literal(EXECUTION_CLAIM_TYPE)
  })
  .strict();

export type ExecutionClaimHeader = z.infer<typeof executionClaimHeaderSchema>;

export const executionClaimPayloadSchema = z
  .object({
    version: z.literal(1),
    iss: identifierSchema,
    aud: identifierSchema,
    jti: sha256Schema,
    iat: epochSecondsSchema,
    nbf: epochSecondsSchema,
    exp: epochSecondsSchema,
    operation: z.enum(EXECUTION_CLAIM_OPERATIONS),
    organisationId: identifierSchema,
    agentId: identifierSchema,
    mandateId: identifierSchema,
    authorizationId: identifierSchema,
    executionId: identifierSchema,
    attempt: z.number().int().positive(),
    requestHash: sha256Schema
  })
  .strict();

export type ExecutionClaimPayload = z.infer<typeof executionClaimPayloadSchema>;

export const EXECUTION_CLAIM_ERROR_CODES = [
  "MALFORMED_CLAIM",
  "UNSUPPORTED_ALGORITHM",
  "UNKNOWN_SIGNING_KEY",
  "INVALID_SIGNATURE",
  "CLAIM_NOT_YET_VALID",
  "CLAIM_EXPIRED",
  "CLAIM_LIFETIME_EXCEEDED",
  "CLAIM_CONTEXT_MISMATCH",
  "CLAIM_REPLAYED"
] as const;

export type ExecutionClaimErrorCode = (typeof EXECUTION_CLAIM_ERROR_CODES)[number];

export class ExecutionClaimError extends Error {
  override readonly name = "ExecutionClaimError";

  constructor(
    readonly code: ExecutionClaimErrorCode,
    message: string
  ) {
    super(message);
  }
}

function malformed(message: string): never {
  throw new ExecutionClaimError("MALFORMED_CLAIM", message);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, entry]) => [key, canonicalize(entry)])
    );
  }
  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function parseContext(context: ExecutionClaimContext): ExecutionClaimContext {
  const result = executionClaimContextSchema.safeParse(context);
  if (!result.success) {
    throw new ExecutionClaimError("CLAIM_CONTEXT_MISMATCH", "The execution context is malformed");
  }
  return result.data;
}

export function executionActionHash(action: ExecutionAction): string {
  const result = executionActionSchema.safeParse(action);
  if (!result.success) {
    throw new ExecutionClaimError("CLAIM_CONTEXT_MISMATCH", "The execution action is malformed");
  }
  return sha256(canonicalJson(result.data));
}

export function executionClaimId(context: ExecutionClaimContext): string {
  const parsed = parseContext(context);
  return sha256(
    canonicalJson({
      version: 1,
      operation: parsed.operation,
      organisationId: parsed.organisationId,
      agentId: parsed.agentId,
      mandateId: parsed.mandateId,
      authorizationId: parsed.authorizationId,
      executionId: parsed.executionId,
      attempt: parsed.attempt,
      requestHash: executionActionHash(parsed.action)
    })
  );
}

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decode(segment: string, label: string, maximumBytes: number): Buffer {
  if (!segment || !/^[A-Za-z0-9_-]+$/.test(segment)) malformed(`The ${label} encoding is invalid`);
  const decoded = Buffer.from(segment, "base64url");
  if (decoded.byteLength > maximumBytes || decoded.toString("base64url") !== segment) {
    malformed(`The ${label} encoding is invalid`);
  }
  return decoded;
}

function parseJson(segment: string, label: string, maximumBytes: number): unknown {
  try {
    return JSON.parse(decode(segment, label, maximumBytes).toString("utf8"));
  } catch (error) {
    if (error instanceof ExecutionClaimError) throw error;
    return malformed(`The ${label} is not valid JSON`);
  }
}

export type ExecutionClaimKeyMaterial = string | Buffer | KeyObject;

function privateKey(material: ExecutionClaimKeyMaterial): KeyObject {
  const key = material instanceof KeyObject ? material : createPrivateKey(material);
  if (key.type !== "private" || key.asymmetricKeyType !== "ec" || key.asymmetricKeyDetails?.namedCurve !== "prime256v1") {
    throw new Error("Execution claim signing requires a P-256 EC private key");
  }
  return key;
}

function publicKey(material: ExecutionClaimKeyMaterial): KeyObject {
  const key = material instanceof KeyObject
    ? material.type === "private"
      ? createPublicKey(material)
      : material
    : createPublicKey(material);
  if (key.type !== "public" || key.asymmetricKeyType !== "ec" || key.asymmetricKeyDetails?.namedCurve !== "prime256v1") {
    throw new Error("Execution claim verification requires a P-256 EC public key");
  }
  return key;
}

function integerWithin(value: number, minimum: number, maximum: number, label: string): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
}

export interface IssuedExecutionClaim {
  token: string;
  header: ExecutionClaimHeader;
  payload: ExecutionClaimPayload;
}

export interface ExecutionClaimIssuer {
  readonly issuer: string;
  readonly audience: string;
  readonly keyId: string;
  issue(context: ExecutionClaimContext): IssuedExecutionClaim;
}

export interface Es256ExecutionClaimIssuerConfig {
  privateKey: ExecutionClaimKeyMaterial;
  keyId: string;
  issuer: string;
  audience: string;
  ttlSeconds?: number;
  clock?: () => Date;
}

export class Es256ExecutionClaimIssuer implements ExecutionClaimIssuer {
  readonly issuer: string;
  readonly audience: string;
  readonly keyId: string;
  private readonly signingKey: KeyObject;
  private readonly ttlSeconds: number;
  private readonly clock: () => Date;

  constructor(config: Es256ExecutionClaimIssuerConfig) {
    this.issuer = identifierSchema.parse(config.issuer);
    this.audience = identifierSchema.parse(config.audience);
    this.keyId = identifierSchema.parse(config.keyId);
    this.signingKey = privateKey(config.privateKey);
    this.ttlSeconds = integerWithin(
      config.ttlSeconds ?? DEFAULT_EXECUTION_CLAIM_TTL_SECONDS,
      1,
      300,
      "Execution claim TTL"
    );
    this.clock = config.clock ?? (() => new Date());
  }

  issue(context: ExecutionClaimContext): IssuedExecutionClaim {
    const parsed = parseContext(context);
    const now = Math.floor(this.clock().getTime() / 1000);
    if (!Number.isSafeInteger(now) || now < 0) throw new Error("Execution claim clock is invalid");
    const header: ExecutionClaimHeader = {
      alg: EXECUTION_CLAIM_ALGORITHM,
      kid: this.keyId,
      typ: EXECUTION_CLAIM_TYPE
    };
    const payload: ExecutionClaimPayload = {
      version: 1,
      iss: this.issuer,
      aud: this.audience,
      jti: executionClaimId(parsed),
      iat: now,
      nbf: now,
      exp: now + this.ttlSeconds,
      operation: parsed.operation,
      organisationId: parsed.organisationId,
      agentId: parsed.agentId,
      mandateId: parsed.mandateId,
      authorizationId: parsed.authorizationId,
      executionId: parsed.executionId,
      attempt: parsed.attempt,
      requestHash: executionActionHash(parsed.action)
    };
    const encodedHeader = encode(header);
    const encodedPayload = encode(payload);
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const signature = cryptoSign("sha256", Buffer.from(signingInput, "ascii"), {
      key: this.signingKey,
      dsaEncoding: "ieee-p1363"
    });
    return {
      token: `${signingInput}.${signature.toString("base64url")}`,
      header,
      payload
    };
  }
}

export interface ExecutionClaimVerifier {
  verify(token: string, context: ExecutionClaimContext): ExecutionClaimPayload;
}

export interface Es256ExecutionClaimVerifierConfig {
  publicKeys: Readonly<Record<string, ExecutionClaimKeyMaterial>>;
  expectedIssuer: string;
  expectedAudience: string;
  allowedClockSkewSeconds?: number;
  maximumTtlSeconds?: number;
  clock?: () => Date;
}

export class Es256ExecutionClaimVerifier implements ExecutionClaimVerifier {
  private readonly publicKeys: ReadonlyMap<string, KeyObject>;
  private readonly expectedIssuer: string;
  private readonly expectedAudience: string;
  private readonly allowedClockSkewSeconds: number;
  private readonly maximumTtlSeconds: number;
  private readonly clock: () => Date;

  constructor(config: Es256ExecutionClaimVerifierConfig) {
    const entries = Object.entries(config.publicKeys);
    if (entries.length === 0) throw new Error("At least one execution claim public key is required");
    this.publicKeys = new Map(entries.map(([keyId, material]) => [identifierSchema.parse(keyId), publicKey(material)]));
    this.expectedIssuer = identifierSchema.parse(config.expectedIssuer);
    this.expectedAudience = identifierSchema.parse(config.expectedAudience);
    this.allowedClockSkewSeconds = integerWithin(config.allowedClockSkewSeconds ?? 5, 0, 60, "Clock skew");
    this.maximumTtlSeconds = integerWithin(
      config.maximumTtlSeconds ?? DEFAULT_EXECUTION_CLAIM_MAX_TTL_SECONDS,
      1,
      300,
      "Maximum execution claim TTL"
    );
    this.clock = config.clock ?? (() => new Date());
  }

  verify(token: string, context: ExecutionClaimContext): ExecutionClaimPayload {
    if (typeof token !== "string" || token.length === 0 || token.length > 16_384) {
      return malformed("The execution claim has an invalid length");
    }
    const segments = token.split(".");
    if (segments.length !== 3) return malformed("The execution claim must contain three segments");
    const encodedHeader = segments[0];
    const encodedPayload = segments[1];
    const encodedSignature = segments[2];
    if (!encodedHeader || !encodedPayload || !encodedSignature) return malformed("The execution claim is incomplete");

    const headerResult = executionClaimHeaderSchema.safeParse(parseJson(encodedHeader, "claim header", 2_048));
    if (!headerResult.success) {
      const unsupported = headerResult.error.issues.some((issue) => issue.path[0] === "alg");
      throw new ExecutionClaimError(
        unsupported ? "UNSUPPORTED_ALGORITHM" : "MALFORMED_CLAIM",
        unsupported ? "The execution claim algorithm is not supported" : "The execution claim header is malformed"
      );
    }
    const key = this.publicKeys.get(headerResult.data.kid);
    if (!key) throw new ExecutionClaimError("UNKNOWN_SIGNING_KEY", "The execution claim signing key is unknown");
    const signature = decode(encodedSignature, "claim signature", 128);
    if (signature.byteLength !== 64) {
      throw new ExecutionClaimError("INVALID_SIGNATURE", "The execution claim signature has an invalid size");
    }
    const validSignature = cryptoVerify(
      "sha256",
      Buffer.from(`${encodedHeader}.${encodedPayload}`, "ascii"),
      { key, dsaEncoding: "ieee-p1363" },
      signature
    );
    if (!validSignature) throw new ExecutionClaimError("INVALID_SIGNATURE", "The execution claim signature is invalid");

    const payloadResult = executionClaimPayloadSchema.safeParse(parseJson(encodedPayload, "claim payload", 12_288));
    if (!payloadResult.success) return malformed("The execution claim payload is malformed");
    const payload = payloadResult.data;
    if (payload.iss !== this.expectedIssuer || payload.aud !== this.expectedAudience) {
      throw new ExecutionClaimError("CLAIM_CONTEXT_MISMATCH", "The execution claim issuer or audience does not match");
    }
    if (payload.nbf !== payload.iat || payload.exp <= payload.iat) {
      return malformed("The execution claim validity window is malformed");
    }
    if (payload.exp - payload.iat > this.maximumTtlSeconds) {
      throw new ExecutionClaimError("CLAIM_LIFETIME_EXCEEDED", "The execution claim lifetime exceeds the Gate limit");
    }
    const now = Math.floor(this.clock().getTime() / 1000);
    if (!Number.isSafeInteger(now) || now < 0) throw new Error("Execution claim clock is invalid");
    if (payload.iat > now + this.allowedClockSkewSeconds || payload.nbf > now + this.allowedClockSkewSeconds) {
      throw new ExecutionClaimError("CLAIM_NOT_YET_VALID", "The execution claim is not yet valid");
    }
    if (payload.exp <= now - this.allowedClockSkewSeconds) {
      throw new ExecutionClaimError("CLAIM_EXPIRED", "The execution claim has expired");
    }

    const parsedContext = parseContext(context);
    const expected = {
      operation: parsedContext.operation,
      organisationId: parsedContext.organisationId,
      agentId: parsedContext.agentId,
      mandateId: parsedContext.mandateId,
      authorizationId: parsedContext.authorizationId,
      executionId: parsedContext.executionId,
      attempt: parsedContext.attempt,
      requestHash: executionActionHash(parsedContext.action),
      jti: executionClaimId(parsedContext)
    };
    for (const [keyName, expectedValue] of Object.entries(expected)) {
      if (payload[keyName as keyof typeof expected] !== expectedValue) {
        throw new ExecutionClaimError(
          "CLAIM_CONTEXT_MISMATCH",
          `The execution claim does not bind the expected ${keyName}`
        );
      }
    }
    return payload;
  }
}

export interface ExecutionClaimReplayStore {
  consume(claimId: string, expiresAtEpochSeconds: number): Promise<boolean>;
}

export class InMemoryExecutionClaimReplayStore implements ExecutionClaimReplayStore {
  private readonly claims = new Map<string, number>();
  private readonly retentionSeconds: number;

  constructor(
    private readonly clock: () => Date = () => new Date(),
    retentionSeconds: number = DEFAULT_REPLAY_RETENTION_SECONDS
  ) {
    this.retentionSeconds = integerWithin(retentionSeconds, 60, 86_400, "Replay retention");
  }

  async consume(claimId: string, expiresAtEpochSeconds: number): Promise<boolean> {
    const now = Math.floor(this.clock().getTime() / 1000);
    for (const [storedClaimId, expiresAt] of this.claims) {
      if (expiresAt + this.retentionSeconds <= now) this.claims.delete(storedClaimId);
    }
    if (this.claims.has(claimId)) return false;
    this.claims.set(claimId, expiresAtEpochSeconds);
    return true;
  }
}

export class ExecutionGate {
  constructor(
    private readonly verifier: ExecutionClaimVerifier,
    private readonly replayStore: ExecutionClaimReplayStore
  ) {}

  async consume(token: string, context: ExecutionClaimContext): Promise<ExecutionClaimPayload> {
    const payload = this.verifier.verify(token, context);
    if (!(await this.replayStore.consume(payload.jti, payload.exp))) {
      throw new ExecutionClaimError("CLAIM_REPLAYED", "The execution claim has already been consumed");
    }
    return payload;
  }
}

export interface EphemeralExecutionAuthorityConfig {
  issuer: string;
  audience: string;
  keyId?: string;
  ttlSeconds?: number;
  clock?: () => Date;
}

export interface EphemeralExecutionAuthority {
  issuer: ExecutionClaimIssuer;
  gate: ExecutionGate;
  publicKeyPem: string;
}

export function createEphemeralExecutionAuthority(
  config: EphemeralExecutionAuthorityConfig
): EphemeralExecutionAuthority {
  const pair = generateKeyPairSync("ec", {
    namedCurve: "P-256",
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });
  const keyId = config.keyId ?? "capyn-ephemeral-execution-key";
  const clock = config.clock ?? (() => new Date());
  const issuer = new Es256ExecutionClaimIssuer({
    privateKey: pair.privateKey,
    keyId,
    issuer: config.issuer,
    audience: config.audience,
    ...(config.ttlSeconds === undefined ? {} : { ttlSeconds: config.ttlSeconds }),
    clock
  });
  const verifier = new Es256ExecutionClaimVerifier({
    publicKeys: { [keyId]: pair.publicKey },
    expectedIssuer: config.issuer,
    expectedAudience: config.audience,
    clock
  });
  return {
    issuer,
    gate: new ExecutionGate(verifier, new InMemoryExecutionClaimReplayStore(clock)),
    publicKeyPem: pair.publicKey
  };
}

export const executionRequestSchema = z
  .object({
    executionId: identifierSchema,
    authorizationId: identifierSchema,
    organisationId: identifierSchema,
    agentId: identifierSchema,
    capability: z.string().trim().min(3).max(100),
    amountMinor: z.string().regex(/^[1-9]\d{0,13}$/),
    currency: z.literal("USD"),
    vendor: z
      .object({
        id: z.string().trim().min(1).max(100),
        name: z.string().trim().min(1).max(160).nullable()
      })
      .strict(),
    metadata: z.record(jsonValueSchema),
    mandateId: identifierSchema,
    requestHash: sha256Schema,
    attemptCount: z.number().int().positive()
  })
  .strict();

export type ExecutionRequest = z.infer<typeof executionRequestSchema>;

export const paymentExecutionResultSchema = z
  .object({
    status: z.enum(["EXECUTED", "FAILED", "UNKNOWN"]),
    reference: z.string().trim().min(1).max(200).nullable(),
    errorCode: z.string().trim().min(1).max(100).nullable()
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === "EXECUTED" && (value.reference === null || value.errorCode !== null)) {
      context.addIssue({
        code: "custom",
        message: "An executed provider result requires a reference and no error code"
      });
    }
    if (value.status !== "EXECUTED" && value.errorCode === null) {
      context.addIssue({ code: "custom", message: "A non-executed provider result requires an error code" });
    }
  });

export type PaymentExecutionResult = z.infer<typeof paymentExecutionResultSchema>;

export interface PaymentExecutor {
  readonly name: string;
  execute(request: ExecutionRequest): Promise<PaymentExecutionResult>;
  reconcile(request: ExecutionRequest): Promise<PaymentExecutionResult>;
}

export function executionClaimContextFromRequest(
  request: ExecutionRequest,
  operation: ExecutionClaimOperation
): ExecutionClaimContext {
  const result = executionRequestSchema.safeParse(request);
  if (!result.success) {
    throw new ExecutionClaimError("CLAIM_CONTEXT_MISMATCH", "The execution request is malformed");
  }
  const parsed = result.data;
  const context: ExecutionClaimContext = {
    operation,
    organisationId: parsed.organisationId,
    agentId: parsed.agentId,
    mandateId: parsed.mandateId,
    authorizationId: parsed.authorizationId,
    executionId: parsed.executionId,
    attempt: parsed.attemptCount,
    action: {
      capability: parsed.capability,
      amountMinor: parsed.amountMinor,
      currency: parsed.currency,
      vendor: parsed.vendor,
      metadata: parsed.metadata
    }
  };
  if (executionActionHash(context.action) !== parsed.requestHash) {
    throw new ExecutionClaimError(
      "CLAIM_CONTEXT_MISMATCH",
      "The stored authorization fingerprint does not match the execution action"
    );
  }
  return context;
}

export const executionGatewayRequestSchema = z
  .object({
    claim: z.string().min(1).max(16_384),
    operation: z.enum(EXECUTION_CLAIM_OPERATIONS),
    request: executionRequestSchema
  })
  .strict();

export type ExecutionGatewayRequest = z.infer<typeof executionGatewayRequestSchema>;

const gateReceiptBaseSchema = z
  .object({
    version: z.literal(1),
    gateId: identifierSchema,
    claimId: sha256Schema,
    operation: z.enum(EXECUTION_CLAIM_OPERATIONS),
    provider: identifierSchema,
    requestHash: sha256Schema,
    outcome: z.enum(["EXECUTED", "FAILED", "UNKNOWN"]),
    reference: z.string().trim().min(1).max(200).nullable(),
    errorCode: z.string().trim().min(1).max(100).nullable(),
    consumedAt: z.string().datetime({ offset: true }),
    completedAt: z.string().datetime({ offset: true })
  })
  .strict();

const executionGateReceiptSignatureSchema = z
  .string()
  .trim()
  .min(64)
  .max(64)
  .regex(/^[a-f0-9]+$/);

const executionGateReceiptSignableSchema = gateReceiptBaseSchema
  .extend({ receiptHash: sha256Schema })
  .strict();

export type ExecutionGateReceiptSignable = z.infer<typeof executionGateReceiptSignableSchema>;

export const executionGateReceiptSchema = executionGateReceiptSignableSchema
  .extend({ receiptSignature: executionGateReceiptSignatureSchema.optional() })
  .strict();

export type ExecutionGateReceipt = z.infer<typeof executionGateReceiptSchema>;

export const executionGatewayResultSchema = z
  .object({
    result: paymentExecutionResultSchema,
    receipt: executionGateReceiptSchema
  })
  .strict();

export type ExecutionGatewayResult = z.infer<typeof executionGatewayResultSchema>;

const MINIMUM_RECEIPT_SIGNING_SECRET_BYTES = 16;

function executionReceiptSigningKey(secret: string | Buffer): Buffer {
  const bytes = typeof secret === "string" ? Buffer.from(secret, "utf8") : secret;
  if (bytes.length < MINIMUM_RECEIPT_SIGNING_SECRET_BYTES) {
    throw new Error("Execution receipt signing secret must be at least 16 bytes");
  }
  return bytes;
}

function toSignableReceipt(receipt: Omit<ExecutionGateReceipt, "receiptSignature">): ExecutionGateReceiptSignable {
  return executionGateReceiptSignableSchema.parse(receipt);
}

export function signExecutionGateReceipt(
  secret: string | Buffer,
  receipt: Omit<ExecutionGateReceipt, "receiptSignature">
): string {
  const signed = toSignableReceipt(receipt);
  return createHmac("sha256", executionReceiptSigningKey(secret))
    .update(canonicalJson(signed), "utf8")
    .digest("hex");
}

export function verifyExecutionGateReceipt(
  secret: string | Buffer,
  receipt: Omit<ExecutionGateReceipt, "receiptSignature">,
  signature: string
): boolean {
  if (!executionGateReceiptSignatureSchema.safeParse(signature).success) return false;
  const expected = signExecutionGateReceipt(secret, receipt);
  const expectedBytes = Buffer.from(expected, "hex");
  const actualBytes = Buffer.from(signature, "hex");
  if (expectedBytes.length !== actualBytes.length) return false;
  return timingSafeEqual(expectedBytes, actualBytes);
}

export function executionGateReceiptHash(
  receipt: Omit<ExecutionGateReceipt, "receiptHash">
): string {
  return sha256(canonicalJson(gateReceiptBaseSchema.parse(receipt)));
}

export interface ExecutionGateway {
  readonly name: string;
  invoke(request: ExecutionGatewayRequest): Promise<ExecutionGatewayResult>;
}

export interface LocalExecutionGatewayConfig {
  gateId: string;
  gate: ExecutionGate;
  executor: PaymentExecutor;
  receiptSigningSecret?: string | Buffer;
  clock?: () => Date;
}

export class LocalExecutionGateway implements ExecutionGateway {
  readonly name: string;
  private readonly gateId: string;
  private readonly gate: ExecutionGate;
  private readonly executor: PaymentExecutor;
  private readonly clock: () => Date;
  private readonly receiptSigningSecret: string | Buffer | undefined;

  constructor(config: LocalExecutionGatewayConfig) {
    this.gateId = identifierSchema.parse(config.gateId);
    this.gate = config.gate;
    this.executor = config.executor;
    this.name = identifierSchema.parse(config.executor.name);
    this.receiptSigningSecret = config.receiptSigningSecret;
    this.clock = config.clock ?? (() => new Date());
  }

  async invoke(invocation: ExecutionGatewayRequest): Promise<ExecutionGatewayResult> {
    const parsed = executionGatewayRequestSchema.parse(invocation);
    const context = executionClaimContextFromRequest(parsed.request, parsed.operation);
    const payload = await this.gate.consume(parsed.claim, context);
    const consumedAt = this.clock().toISOString();
    let result: PaymentExecutionResult;
    try {
      const providerResult = parsed.operation === "RECONCILE"
        ? await this.executor.reconcile(parsed.request)
        : await this.executor.execute(parsed.request);
      const validated = paymentExecutionResultSchema.safeParse(providerResult);
      result = validated.success
        ? validated.data
        : { status: "UNKNOWN", reference: null, errorCode: "PROVIDER_INVALID_RESPONSE" };
    } catch {
      result = { status: "UNKNOWN", reference: null, errorCode: "PROVIDER_OUTCOME_UNKNOWN" };
    }
    const receiptBase: Omit<ExecutionGateReceiptSignable, "receiptHash" | "receiptSignature"> = {
      version: 1,
      gateId: this.gateId,
      claimId: payload.jti,
      operation: parsed.operation,
      provider: this.name,
      requestHash: payload.requestHash,
      outcome: result.status,
      reference: result.reference,
      errorCode: result.errorCode,
      consumedAt,
      completedAt: this.clock().toISOString()
    };
    const signedReceiptBase: ExecutionGateReceiptSignable = {
      ...receiptBase,
      receiptHash: executionGateReceiptHash(receiptBase)
    };
    const receipt = this.receiptSigningSecret === undefined
      ? signedReceiptBase
      : {
        ...signedReceiptBase,
        receiptSignature: signExecutionGateReceipt(this.receiptSigningSecret, signedReceiptBase)
      };
    return {
      result,
      receipt
    };
  }
}

export const EXECUTION_GATEWAY_REJECTION_CODES = [
  "CONTROL_CHANNEL_REJECTED",
  "REQUEST_REJECTED"
] as const;

export type ExecutionGatewayRejectionCode = (typeof EXECUTION_GATEWAY_REJECTION_CODES)[number];

export class ExecutionGatewayRejectedError extends Error {
  override readonly name = "ExecutionGatewayRejectedError";

  constructor(
    readonly code: ExecutionGatewayRejectionCode,
    message: string
  ) {
    super(message);
  }
}

interface GatewayErrorBody {
  error?: { code?: unknown; message?: unknown };
}

function remoteClaimError(body: GatewayErrorBody, status: number): ExecutionClaimError | null {
  if (status !== 409 && status !== 422) return null;
  const code = body.error?.code;
  if (typeof code !== "string" || !code.startsWith("GATE_")) return null;
  const claimCode = code.slice(5);
  if (!(EXECUTION_CLAIM_ERROR_CODES as readonly string[]).includes(claimCode)) return null;
  const message = typeof body.error?.message === "string"
    ? body.error.message
    : "The remote Gate rejected the execution claim";
  return new ExecutionClaimError(claimCode as ExecutionClaimErrorCode, message);
}

function remoteGatewayRejection(body: GatewayErrorBody, status: number): ExecutionGatewayRejectedError | null {
  const code = body.error?.code;
  if ((status === 401 || status === 403) && code === "GATE_CONTROL_CHANNEL_REJECTED") {
    return new ExecutionGatewayRejectedError(
      "CONTROL_CHANNEL_REJECTED",
      "The remote Gate rejected control-plane authentication"
    );
  }
  if (status === 400 && code === "GATE_REQUEST_INVALID") {
    return new ExecutionGatewayRejectedError("REQUEST_REJECTED", "The remote Gate rejected the invocation");
  }
  return null;
}

export interface HttpExecutionGatewayConfig {
  baseUrl: string;
  controlToken: string;
  providerName: string;
  expectedGateId: string;
  receiptSigningSecret?: string | Buffer;
  timeoutMs?: number;
  fetchImplementation?: typeof fetch;
}

const MAXIMUM_GATE_RESPONSE_BYTES = 65_536;

async function readGateResponse(response: Response): Promise<string> {
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    const declaredBytes = Number(contentLength);
    if (Number.isFinite(declaredBytes) && declaredBytes > MAXIMUM_GATE_RESPONSE_BYTES) {
      throw new Error("Execution Gate response exceeded the maximum size");
    }
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      totalBytes += chunk.value.byteLength;
      if (totalBytes > MAXIMUM_GATE_RESPONSE_BYTES) {
        try {
          await reader.cancel();
        } catch {
          // The size failure remains authoritative even if stream cancellation fails.
        }
        throw new Error("Execution Gate response exceeded the maximum size");
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
}

export class HttpExecutionGateway implements ExecutionGateway {
  readonly name: string;
  private readonly endpoint: URL;
  private readonly controlToken: string;
  private readonly expectedGateId: string;
  private readonly receiptSigningSecret: string | Buffer | undefined;
  private readonly timeoutMs: number;
  private readonly fetchImplementation: typeof fetch;

  constructor(config: HttpExecutionGatewayConfig) {
    const baseUrl = new URL(config.baseUrl);
    if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") {
      throw new Error("Execution Gate URL must use HTTP or HTTPS");
    }
    if (config.controlToken.length < 32) throw new Error("Execution Gate control token must be at least 32 characters");
    this.endpoint = new URL("v1/invoke", baseUrl.href.endsWith("/") ? baseUrl : `${baseUrl.href}/`);
    this.controlToken = config.controlToken;
    this.name = identifierSchema.parse(config.providerName);
    this.expectedGateId = identifierSchema.parse(config.expectedGateId);
    this.receiptSigningSecret = config.receiptSigningSecret;
    this.timeoutMs = integerWithin(config.timeoutMs ?? 10_000, 100, 120_000, "Execution Gate timeout");
    this.fetchImplementation = config.fetchImplementation ?? fetch;
  }

  async invoke(invocation: ExecutionGatewayRequest): Promise<ExecutionGatewayResult> {
    const parsed = executionGatewayRequestSchema.parse(invocation);
    const context = executionClaimContextFromRequest(parsed.request, parsed.operation);
    const expectedClaimId = executionClaimId(context);
    const response = await this.fetchImplementation(this.endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.controlToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(parsed),
      signal: AbortSignal.timeout(this.timeoutMs)
    });
    const responseText = await readGateResponse(response);
    let body: unknown = null;
    try {
      body = responseText ? JSON.parse(responseText) : null;
    } catch {
      throw new Error("Execution Gate returned malformed JSON");
    }
    if (!response.ok) {
      const errorBody = body !== null && typeof body === "object" ? body as GatewayErrorBody : {};
      const claimError = remoteClaimError(errorBody, response.status);
      if (claimError) throw claimError;
      const rejection = remoteGatewayRejection(errorBody, response.status);
      if (rejection) throw rejection;
      throw new Error(`Execution Gate failed with HTTP ${response.status}`);
    }
    const result = executionGatewayResultSchema.safeParse(body);
    if (!result.success) throw new Error("Execution Gate returned an invalid result");
    const receipt = result.data.receipt;
    if (
      receipt.gateId !== this.expectedGateId ||
      receipt.provider !== this.name ||
      receipt.claimId !== expectedClaimId ||
      receipt.operation !== parsed.operation ||
      receipt.requestHash !== parsed.request.requestHash ||
      receipt.outcome !== result.data.result.status ||
      receipt.reference !== result.data.result.reference ||
      receipt.errorCode !== result.data.result.errorCode ||
      executionGateReceiptHash({
        version: receipt.version,
        gateId: receipt.gateId,
        claimId: receipt.claimId,
        operation: receipt.operation,
        provider: receipt.provider,
        requestHash: receipt.requestHash,
        outcome: receipt.outcome,
        reference: receipt.reference,
        errorCode: receipt.errorCode,
        consumedAt: receipt.consumedAt,
        completedAt: receipt.completedAt
      }) !== receipt.receiptHash
    ) {
      throw new Error("Execution Gate receipt does not match the invocation");
    }
    if (this.receiptSigningSecret !== undefined) {
      if (receipt.receiptSignature === undefined) {
        throw new Error("Execution Gate receipt is not signed");
      }
      const { receiptSignature, ...unsignedReceipt } = receipt;
      if (!verifyExecutionGateReceipt(this.receiptSigningSecret, unsignedReceipt, receiptSignature)) {
        throw new Error("Execution Gate receipt signature is invalid");
      }
    }
    return result.data;
  }
}
