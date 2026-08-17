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
