import { createHmac, randomBytes } from "node:crypto";

export function assertApiKeyPepper(pepper: string): void {
  if (pepper.length < 32) throw new Error("API_KEY_PEPPER must contain at least 32 characters");
}

export function hashApiKey(apiKey: string, pepper: string): string {
  assertApiKeyPepper(pepper);
  return createHmac("sha256", pepper).update(apiKey, "utf8").digest("hex");
}

export function generateApiKey(environment: "live" | "test" = "live"): {
  apiKey: string;
  keyPrefix: string;
} {
  const apiKey = `capyn_${environment}_${randomBytes(32).toString("base64url")}`;
  return { apiKey, keyPrefix: apiKey.slice(0, 18) };
}

export function deriveRotatedApiKey(credentialId: string, pepper: string): {
  apiKey: string;
  keyPrefix: string;
} {
  assertApiKeyPepper(pepper);
  const material = createHmac("sha256", pepper)
    .update(`capyn-agent-credential-rotation-v1\u0000${credentialId}`, "utf8")
    .digest("base64url");
  const apiKey = `capyn_live_${material}`;
  return { apiKey, keyPrefix: apiKey.slice(0, 18) };
}

function deriveProvisionedKey(
  prefix: "capyn_live_" | "capyn_owner_live_",
  domain: string,
  credentialId: string,
  pepper: string
): { apiKey: string; keyPrefix: string } {
  assertApiKeyPepper(pepper);
  const material = createHmac("sha256", pepper)
    .update(`${domain}\u0000${credentialId}`, "utf8")
    .digest("base64url");
  const apiKey = `${prefix}${material}`;
  return { apiKey, keyPrefix: apiKey.slice(0, prefix === "capyn_owner_live_" ? 24 : 18) };
}

export function deriveOnboardingAgentApiKey(credentialId: string, pepper: string): {
  apiKey: string;
  keyPrefix: string;
} {
  return deriveProvisionedKey(
    "capyn_live_",
    "capyn-agent-onboarding-credential-v1",
    credentialId,
    pepper
  );
}

export function deriveOwnerAccessKey(credentialId: string, pepper: string): {
  apiKey: string;
  keyPrefix: string;
} {
  return deriveProvisionedKey(
    "capyn_owner_live_",
    "capyn-owner-access-credential-v1",
    credentialId,
    pepper
  );
}
