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
