import type { LabEvidence, LabEvidenceEvent, LabEvaluateRequest } from "@capyn/types";
import { canonicalJson } from "./canonical-json";

export { canonicalJson } from "./canonical-json";

export const LAB_PROOF_SCHEMA_VERSION = 1 as const;

export type LabProofDecision = "ALLOW" | "DENY" | "REQUIRE_APPROVAL" | "APPROVED" | "REJECTED" | "UNDECIDED";

export interface LabProofBundle {
  schemaVersion: typeof LAB_PROOF_SCHEMA_VERSION;
  mode: "SYNTHETIC";
  authorizationId: string;
  request: LabEvaluateRequest;
  evidence: LabEvidence;
}

const proofEventTypes = new Set<LabEvidenceEvent["type"]>([
  "REQUEST_RECEIVED",
  "POLICY_EVALUATED",
  "APPROVAL_OPENED",
  "APPROVAL_RECORDED",
  "REQUEST_STOPPED",
  "EXECUTION_SIMULATED"
]);

const proofActors = new Set<LabEvidenceEvent["actor"]>([
  "procurement-agent",
  "CAPYN policy engine",
  "human approver",
  "synthetic executor"
]);

const moneyPattern = /^(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,2})?$/;
const capabilityPattern = /^[a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]*)+$/;
const vendorIdPattern = /^[a-z0-9][a-z0-9_-]*$/i;
const digestPattern = /^[a-f0-9]{64}$/;
const tokenPattern = /^[A-Za-z0-9_-]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundedString(value: unknown, minimum: number, maximum: number): value is string {
  return typeof value === "string" && value.length >= minimum && value.length <= maximum;
}

function parseRequest(value: unknown): LabEvaluateRequest | null {
  if (!isRecord(value)) return null;
  if (!isBoundedString(value.capability, 3, 100) || !capabilityPattern.test(value.capability)) return null;
  if (!isRecord(value.amount) || !isBoundedString(value.amount.value, 1, 16) || !moneyPattern.test(value.amount.value)) return null;
  if (value.amount.currency !== "USD") return null;
  if (!isRecord(value.vendor) || !isBoundedString(value.vendor.id, 1, 100) || !vendorIdPattern.test(value.vendor.id)) return null;
  if (value.vendor.name !== undefined && !isBoundedString(value.vendor.name, 1, 160)) return null;
  if (!isBoundedString(value.purpose, 3, 160)) return null;
  return {
    capability: value.capability,
    amount: { value: value.amount.value, currency: value.amount.currency },
    vendor: { id: value.vendor.id, ...(value.vendor.name ? { name: value.vendor.name } : {}) },
    purpose: value.purpose
  };
}

function parseEvidence(value: unknown): LabEvidence | null {
  if (!isRecord(value) || !isBoundedString(value.receiptId, 1, 160)) return null;
  if (!isBoundedString(value.digest, 64, 64) || !digestPattern.test(value.digest)) return null;
  if (!Array.isArray(value.events) || value.events.length < 1 || value.events.length > 12) return null;
  const events: LabEvidenceEvent[] = [];
  for (const [index, item] of value.events.entries()) {
    if (!isRecord(item) || item.sequence !== index + 1) return null;
    if (!proofEventTypes.has(item.type as LabEvidenceEvent["type"])) return null;
    if (!proofActors.has(item.actor as LabEvidenceEvent["actor"])) return null;
    if (!isBoundedString(item.timestamp, 20, 40) || !Number.isFinite(Date.parse(item.timestamp))) return null;
    if (!isBoundedString(item.detail, 1, 240)) return null;
    events.push({
      sequence: item.sequence,
      type: item.type as LabEvidenceEvent["type"],
      actor: item.actor as LabEvidenceEvent["actor"],
      timestamp: item.timestamp,
      detail: item.detail
    });
  }
  return { receiptId: value.receiptId, digest: value.digest, events };
}

export function createLabProofBundle(
  authorizationId: string,
  request: LabEvaluateRequest,
  evidence: LabEvidence
): LabProofBundle {
  return {
    schemaVersion: LAB_PROOF_SCHEMA_VERSION,
    mode: "SYNTHETIC",
    authorizationId,
    request: {
      ...request,
      amount: { ...request.amount },
      vendor: { ...request.vendor }
    },
    evidence: {
      ...evidence,
      events: evidence.events.map((event) => ({ ...event }))
    }
  };
}

export function parseLabProofBundle(value: unknown): LabProofBundle | null {
  if (!isRecord(value) || value.schemaVersion !== LAB_PROOF_SCHEMA_VERSION || value.mode !== "SYNTHETIC") return null;
  if (!isBoundedString(value.authorizationId, 1, 160)) return null;
  const request = parseRequest(value.request);
  const evidence = parseEvidence(value.evidence);
  if (!request || !evidence) return null;
  return createLabProofBundle(value.authorizationId, request, evidence);
}

function digestPayload(bundle: LabProofBundle): unknown {
  return {
    authorizationId: bundle.authorizationId,
    receiptId: bundle.evidence.receiptId,
    request: bundle.request,
    events: bundle.evidence.events
  };
}

export async function computeLabProofDigest(bundle: LabProofBundle): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(digestPayload(bundle)));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyLabProofDigest(bundle: LabProofBundle): Promise<boolean> {
  return (await computeLabProofDigest(bundle)) === bundle.evidence.digest;
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

export function serializeLabProof(bundle: LabProofBundle): string {
  return bytesToBase64(new TextEncoder().encode(JSON.stringify(bundle)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}

export function parseLabProofToken(token: string): LabProofBundle | null {
  const clean = token.startsWith("#") ? token.slice(1) : token;
  if (!clean || clean.length > 16_000 || !tokenPattern.test(clean)) return null;
  try {
    const padded = clean.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(clean.length / 4) * 4, "=");
    return parseLabProofBundle(JSON.parse(new TextDecoder().decode(base64ToBytes(padded))));
  } catch {
    return null;
  }
}

export function createLabProofHref(bundle: LabProofBundle): string {
  return `/proof#${serializeLabProof(bundle)}`;
}

export function deriveLabProofDecision(events: LabEvidenceEvent[]): LabProofDecision {
  const finalEvent = events.at(-1);
  const approval = events.find((event) => event.type === "APPROVAL_RECORDED");
  if (finalEvent?.type === "APPROVAL_OPENED") return "REQUIRE_APPROVAL";
  if (finalEvent?.type === "EXECUTION_SIMULATED") return approval?.detail.startsWith("APPROVED") ? "APPROVED" : "ALLOW";
  if (finalEvent?.type === "REQUEST_STOPPED") return approval?.detail.startsWith("REJECTED") ? "REJECTED" : "DENY";
  return "UNDECIDED";
}

export function formatLabEvidenceOffset(events: LabEvidenceEvent[], index: number): string {
  const first = Date.parse(events[0]?.timestamp ?? "");
  const current = Date.parse(events[index]?.timestamp ?? "");
  if (!Number.isFinite(first) || !Number.isFinite(current)) return "T+—";
  return `T+${Math.max(0, current - first).toString().padStart(4, "0")}ms`;
}
