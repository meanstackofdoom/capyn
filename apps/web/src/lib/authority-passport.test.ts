import { describe, expect, it } from "vitest";
import {
  computeAuthorityPassportDigest,
  createAuthorityPassportEnvelope,
  createAuthorityPassportHref,
  createMandateDraftFromAuthorityPassport,
  parseAuthorityPassportEnvelope,
  parseAuthorityPassportToken,
  serializeAuthorityPassport,
  verifyAuthorityPassportEnvelope
} from "./authority-passport";
import { createMandateStudioDraft } from "./mandate-studio";

const issuedAt = "2026-08-18T03:00:00.000Z";

describe("Authority Passport", () => {
  it("creates and verifies a digest-covered mandate passport", async () => {
    const envelope = await createAuthorityPassportEnvelope(createMandateStudioDraft("inference"), issuedAt);
    expect(envelope.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(await verifyAuthorityPassportEnvelope(envelope)).toBe(true);
    expect(await computeAuthorityPassportDigest(envelope.passport)).toBe(envelope.digest);
  });

  it("round-trips a URL-safe fragment without sending the payload as a query", async () => {
    const envelope = await createAuthorityPassportEnvelope(createMandateStudioDraft("software"), issuedAt);
    const token = serializeAuthorityPassport(envelope);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(parseAuthorityPassportToken(token)).toEqual(envelope);
    expect(createAuthorityPassportHref(envelope)).toBe(`/passport#${token}`);
  });

  it("detects a structurally valid payload changed after issue", async () => {
    const envelope = await createAuthorityPassportEnvelope(createMandateStudioDraft("inference"), issuedAt);
    envelope.passport.mandate.purpose = "A changed but still structurally valid purpose";
    expect(await verifyAuthorityPassportEnvelope(envelope)).toBe(false);
  });

  it("fails closed on malformed, oversized, and unsafe structures", async () => {
    const envelope = await createAuthorityPassportEnvelope(createMandateStudioDraft("inference"), issuedAt);
    expect(parseAuthorityPassportToken("not*base64")).toBeNull();
    expect(parseAuthorityPassportToken("a".repeat(16_001))).toBeNull();
    expect(parseAuthorityPassportEnvelope({ schemaVersion: 1, digest: "0".repeat(64) })).toBeNull();

    const unsafe = structuredClone(envelope) as unknown as { passport: { mandate: { limits: { approvalAbove: { value: string } } } } };
    unsafe.passport.mandate.limits.approvalAbove.value = "999.00";
    expect(parseAuthorityPassportEnvelope(unsafe)).toBeNull();
  });

  it("imports a verified passport back into a valid Studio draft", async () => {
    const source = createMandateStudioDraft("treasury");
    const envelope = await createAuthorityPassportEnvelope(source, issuedAt);
    const imported = createMandateDraftFromAuthorityPassport(envelope.passport);
    expect(imported.agentName).toBe(source.agentName);
    expect(imported.capabilities).toEqual(source.capabilities);
    expect(imported.limits).toEqual(source.limits);
    expect(imported.validityDays).toBe(source.validityDays);
  });
});
