import { describe, expect, it } from "vitest";
import type { LabEvidenceEvent } from "@capyn/types";
import {
  canonicalJson,
  computeLabProofDigest,
  createLabProofBundle,
  createLabProofHref,
  deriveLabProofDecision,
  formatLabEvidenceOffset,
  parseLabProofBundle,
  parseLabProofToken,
  serializeLabProof,
  verifyLabProofDigest
} from "./lab-proof";

const baseEvents: LabEvidenceEvent[] = [
  { sequence: 1, type: "REQUEST_RECEIVED", actor: "procurement-agent", timestamp: "2026-08-18T00:00:00.000Z", detail: "spend.compute · $18.00 → OpenAI" },
  { sequence: 2, type: "POLICY_EVALUATED", actor: "CAPYN policy engine", timestamp: "2026-08-18T00:00:00.040Z", detail: "ALLOW" },
  { sequence: 3, type: "EXECUTION_SIMULATED", actor: "synthetic executor", timestamp: "2026-08-18T00:00:00.075Z", detail: "Allowed action reached the mock execution boundary" }
];

function unsignedBundle(events: LabEvidenceEvent[] = baseEvents) {
  return createLabProofBundle(
    "lab_auth_example",
    {
      capability: "spend.compute",
      amount: { value: "18.00", currency: "USD" },
      vendor: { id: "openai", name: "OpenAI" },
      purpose: "Inference capacity for a customer workflow"
    },
    { receiptId: "lab_rcpt_example", digest: "0".repeat(64), events }
  );
}

describe("Lab proof bundle", () => {
  it("canonicalizes object keys recursively", () => {
    expect(canonicalJson({ z: 1, a: { y: 2, b: 3 } })).toBe('{"a":{"b":3,"y":2},"z":1}');
  });

  it("verifies the exact digest-covered evidence payload", async () => {
    const bundle = unsignedBundle();
    bundle.evidence.digest = await computeLabProofDigest(bundle);
    expect(await verifyLabProofDigest(bundle)).toBe(true);
    bundle.evidence.events[2]!.detail = "Tampered outcome";
    expect(await verifyLabProofDigest(bundle)).toBe(false);
  });

  it("round-trips unicode evidence through a URL-safe proof token", async () => {
    const bundle = unsignedBundle();
    bundle.request.purpose = "GPU capacity → Sydney evaluation";
    bundle.evidence.digest = await computeLabProofDigest(bundle);
    const token = serializeLabProof(bundle);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(parseLabProofToken(token)).toEqual(bundle);
    expect(createLabProofHref(bundle)).toBe(`/proof#${token}`);
  });

  it("rejects malformed, oversized, and structurally unsafe proof data", () => {
    expect(parseLabProofToken("not*base64")).toBeNull();
    expect(parseLabProofToken("a".repeat(16_001))).toBeNull();
    expect(parseLabProofBundle({ schemaVersion: 1, mode: "SYNTHETIC" })).toBeNull();
    const unsafe = unsignedBundle();
    unsafe.evidence.events[0]!.sequence = 99;
    expect(parseLabProofBundle(unsafe)).toBeNull();
  });

  it("derives outcomes only from digest-covered events", () => {
    expect(deriveLabProofDecision(baseEvents)).toBe("ALLOW");
    expect(deriveLabProofDecision([...baseEvents.slice(0, 2), { sequence: 3, type: "APPROVAL_OPENED", actor: "CAPYN policy engine", timestamp: baseEvents[2]!.timestamp, detail: "Exact request held" }])).toBe("REQUIRE_APPROVAL");
    expect(deriveLabProofDecision([...baseEvents.slice(0, 2), { sequence: 3, type: "REQUEST_STOPPED", actor: "CAPYN policy engine", timestamp: baseEvents[2]!.timestamp, detail: "Denied" }])).toBe("DENY");
    expect(deriveLabProofDecision([
      ...baseEvents.slice(0, 2),
      { sequence: 3, type: "APPROVAL_OPENED", actor: "CAPYN policy engine", timestamp: baseEvents[2]!.timestamp, detail: "Exact request held" },
      { sequence: 4, type: "APPROVAL_RECORDED", actor: "human approver", timestamp: baseEvents[2]!.timestamp, detail: "APPROVED · exact request only" },
      { sequence: 5, type: "EXECUTION_SIMULATED", actor: "synthetic executor", timestamp: baseEvents[2]!.timestamp, detail: "Approved action reached mock execution" }
    ])).toBe("APPROVED");
  });

  it("formats deterministic flight-recorder offsets", () => {
    expect(formatLabEvidenceOffset(baseEvents, 0)).toBe("T+0000ms");
    expect(formatLabEvidenceOffset(baseEvents, 2)).toBe("T+0075ms");
  });
});
