import { CORE_CAPABILITIES } from "@capyn/types";
import { canonicalJson } from "./canonical-json";
import {
  createMandateStudioDraft,
  type MandateStudioDraft,
  type StudioCapability,
  type StudioValidityDays,
  validateMandateStudioDraft
} from "./mandate-studio";

export const AUTHORITY_PASSPORT_SCHEMA_VERSION = 1 as const;
export const AUTHORITY_PASSPORT_REFERENCE_DATE = "2026-08-18T00:00:00.000Z";

export interface AuthorityPassportVendor {
  id: string;
  name: string;
}

export interface AuthorityPassportLimit {
  value: string;
  currency: "USD";
}

export interface AuthorityPassport {
  schemaVersion: typeof AUTHORITY_PASSPORT_SCHEMA_VERSION;
  mode: "DRAFT_ONLY";
  issuer: "CAPYN_MANDATE_STUDIO";
  issuedAt: string;
  identity: {
    proposedAgentSlug: string;
  };
  mandate: {
    name: string;
    purpose: string;
    capabilities: StudioCapability[];
    allowedVendors: AuthorityPassportVendor[];
    limits: {
      approvalAbove: AuthorityPassportLimit;
      perActionHard: AuthorityPassportLimit;
      dailyHard: AuthorityPassportLimit;
      monthlyHard: AuthorityPassportLimit;
    };
    validityDays: StudioValidityDays;
  };
}

export interface AuthorityPassportEnvelope {
  schemaVersion: typeof AUTHORITY_PASSPORT_SCHEMA_VERSION;
  passport: AuthorityPassport;
  digest: string;
}

const moneyPattern = /^(?:0|[1-9][0-9]{0,8})(?:\.[0-9]{1,2})?$/;
const agentPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const vendorIdPattern = /^[a-z0-9][a-z0-9_-]{0,99}$/;
const digestPattern = /^[a-f0-9]{64}$/;
const tokenPattern = /^[A-Za-z0-9_-]+$/;
const validCapabilities = new Set<string>(CORE_CAPABILITIES);
const validValidityDays = new Set<number>([30, 90, 365]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundedString(value: unknown, minimum: number, maximum: number): value is string {
  return typeof value === "string" && value.length >= minimum && value.length <= maximum;
}

function parseLimit(value: unknown): AuthorityPassportLimit | null {
  if (!isRecord(value) || value.currency !== "USD") return null;
  if (!isBoundedString(value.value, 1, 16) || !moneyPattern.test(value.value) || Number(value.value) <= 0) return null;
  return { value: value.value, currency: "USD" };
}

function parseVendors(value: unknown): AuthorityPassportVendor[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 10) return null;
  const vendors: AuthorityPassportVendor[] = [];
  for (const item of value) {
    if (!isRecord(item)) return null;
    if (!isBoundedString(item.id, 1, 100) || !vendorIdPattern.test(item.id)) return null;
    if (!isBoundedString(item.name, 1, 160)) return null;
    vendors.push({ id: item.id, name: item.name });
  }
  if (new Set(vendors.map((vendor) => vendor.id)).size !== vendors.length) return null;
  return vendors;
}

function parseCapabilities(value: unknown): StudioCapability[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > CORE_CAPABILITIES.length) return null;
  const capabilities: StudioCapability[] = [];
  for (const item of value as unknown[]) {
    if (typeof item !== "string" || !validCapabilities.has(item)) return null;
    capabilities.push(item as StudioCapability);
  }
  if (new Set(capabilities).size !== capabilities.length) return null;
  return capabilities;
}

export function createAuthorityPassport(
  draft: MandateStudioDraft,
  issuedAt = new Date().toISOString()
): AuthorityPassport {
  if (Object.keys(validateMandateStudioDraft(draft)).length > 0) {
    throw new Error("A complete, valid mandate draft is required before a passport can be issued.");
  }
  return {
    schemaVersion: AUTHORITY_PASSPORT_SCHEMA_VERSION,
    mode: "DRAFT_ONLY",
    issuer: "CAPYN_MANDATE_STUDIO",
    issuedAt,
    identity: { proposedAgentSlug: draft.agentName },
    mandate: {
      name: draft.mandateName.trim(),
      purpose: draft.purpose.trim(),
      capabilities: [...draft.capabilities],
      allowedVendors: draft.vendors.map((vendor) => ({ ...vendor })),
      limits: {
        approvalAbove: { value: draft.limits.approvalAbove, currency: "USD" },
        perActionHard: { value: draft.limits.perTransaction, currency: "USD" },
        dailyHard: { value: draft.limits.daily, currency: "USD" },
        monthlyHard: { value: draft.limits.monthly, currency: "USD" }
      },
      validityDays: draft.validityDays
    }
  };
}

export function parseAuthorityPassport(value: unknown): AuthorityPassport | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== AUTHORITY_PASSPORT_SCHEMA_VERSION || value.mode !== "DRAFT_ONLY" || value.issuer !== "CAPYN_MANDATE_STUDIO") return null;
  if (!isBoundedString(value.issuedAt, 20, 40) || !Number.isFinite(Date.parse(value.issuedAt))) return null;
  if (!isRecord(value.identity) || !isBoundedString(value.identity.proposedAgentSlug, 3, 100) || !agentPattern.test(value.identity.proposedAgentSlug)) return null;
  if (!isRecord(value.mandate)) return null;
  if (!isBoundedString(value.mandate.name, 3, 160) || !isBoundedString(value.mandate.purpose, 3, 160)) return null;
  const capabilities = parseCapabilities(value.mandate.capabilities);
  const allowedVendors = parseVendors(value.mandate.allowedVendors);
  if (!capabilities || !allowedVendors || !isRecord(value.mandate.limits)) return null;
  const approvalAbove = parseLimit(value.mandate.limits.approvalAbove);
  const perActionHard = parseLimit(value.mandate.limits.perActionHard);
  const dailyHard = parseLimit(value.mandate.limits.dailyHard);
  const monthlyHard = parseLimit(value.mandate.limits.monthlyHard);
  if (!approvalAbove || !perActionHard || !dailyHard || !monthlyHard) return null;
  if (Number(approvalAbove.value) > Number(perActionHard.value)) return null;
  if (Number(perActionHard.value) > Number(dailyHard.value)) return null;
  if (Number(dailyHard.value) > Number(monthlyHard.value)) return null;
  if (typeof value.mandate.validityDays !== "number" || !validValidityDays.has(value.mandate.validityDays)) return null;
  return {
    schemaVersion: AUTHORITY_PASSPORT_SCHEMA_VERSION,
    mode: "DRAFT_ONLY",
    issuer: "CAPYN_MANDATE_STUDIO",
    issuedAt: value.issuedAt,
    identity: { proposedAgentSlug: value.identity.proposedAgentSlug },
    mandate: {
      name: value.mandate.name,
      purpose: value.mandate.purpose,
      capabilities,
      allowedVendors,
      limits: { approvalAbove, perActionHard, dailyHard, monthlyHard },
      validityDays: value.mandate.validityDays as StudioValidityDays
    }
  };
}

export async function computeAuthorityPassportDigest(passport: AuthorityPassport): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(passport));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createAuthorityPassportEnvelope(
  draft: MandateStudioDraft,
  issuedAt = new Date().toISOString()
): Promise<AuthorityPassportEnvelope> {
  const passport = createAuthorityPassport(draft, issuedAt);
  return {
    schemaVersion: AUTHORITY_PASSPORT_SCHEMA_VERSION,
    passport,
    digest: await computeAuthorityPassportDigest(passport)
  };
}

export function parseAuthorityPassportEnvelope(value: unknown): AuthorityPassportEnvelope | null {
  if (!isRecord(value) || value.schemaVersion !== AUTHORITY_PASSPORT_SCHEMA_VERSION) return null;
  if (!isBoundedString(value.digest, 64, 64) || !digestPattern.test(value.digest)) return null;
  const passport = parseAuthorityPassport(value.passport);
  if (!passport) return null;
  return { schemaVersion: AUTHORITY_PASSPORT_SCHEMA_VERSION, passport, digest: value.digest };
}

export async function verifyAuthorityPassportEnvelope(envelope: AuthorityPassportEnvelope): Promise<boolean> {
  return (await computeAuthorityPassportDigest(envelope.passport)) === envelope.digest;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function serializeAuthorityPassport(envelope: AuthorityPassportEnvelope): string {
  return bytesToBase64(new TextEncoder().encode(JSON.stringify(envelope)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}

export function parseAuthorityPassportToken(token: string): AuthorityPassportEnvelope | null {
  const clean = token.startsWith("#") ? token.slice(1) : token;
  if (!clean || clean.length > 16_000 || !tokenPattern.test(clean)) return null;
  try {
    const padded = clean.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(clean.length / 4) * 4, "=");
    return parseAuthorityPassportEnvelope(JSON.parse(new TextDecoder().decode(base64ToBytes(padded))));
  } catch {
    return null;
  }
}

export function createAuthorityPassportHref(envelope: AuthorityPassportEnvelope): string {
  return `/passport#${serializeAuthorityPassport(envelope)}`;
}

export function createMandateDraftFromAuthorityPassport(passport: AuthorityPassport): MandateStudioDraft {
  const draft = createMandateStudioDraft("inference");
  return {
    ...draft,
    agentName: passport.identity.proposedAgentSlug,
    mandateName: passport.mandate.name,
    purpose: passport.mandate.purpose,
    capabilities: [...passport.mandate.capabilities],
    vendors: passport.mandate.allowedVendors.map((vendor) => ({ ...vendor })),
    limits: {
      approvalAbove: passport.mandate.limits.approvalAbove.value,
      perTransaction: passport.mandate.limits.perActionHard.value,
      daily: passport.mandate.limits.dailyHard.value,
      monthly: passport.mandate.limits.monthlyHard.value
    },
    validityDays: passport.mandate.validityDays
  };
}

export async function createReferenceAuthorityPassportEnvelope(): Promise<AuthorityPassportEnvelope> {
  return createAuthorityPassportEnvelope(createMandateStudioDraft("inference"), AUTHORITY_PASSPORT_REFERENCE_DATE);
}
