import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const PROJECT_STATUS_COOKIE = "capyn-project-status-session";
export const PROJECT_STATUS_SESSION_MAX_AGE = 60 * 60 * 8;

function password(): string | undefined {
  return process.env.PROJECT_STATUS_PASSWORD;
}

function sessionSecret(): string | undefined {
  return process.env.PROJECT_STATUS_SESSION_SECRET;
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function matches(left: string, right: string): boolean {
  return timingSafeEqual(digest(left), digest(right));
}

export function isProjectStatusAuthConfigured(): boolean {
  return Boolean(password() && sessionSecret());
}

export function verifyProjectStatusPassword(candidate: string): boolean {
  const expected = password();
  return Boolean(expected && matches(candidate, expected));
}

export function createProjectStatusSessionToken(): string | null {
  const expectedPassword = password();
  const secret = sessionSecret();
  if (!expectedPassword || !secret) return null;

  const passwordBinding = createHash("sha256").update(expectedPassword, "utf8").digest("base64url");
  return createHmac("sha256", secret)
    .update(`capyn:project-status:v1:${passwordBinding}`, "utf8")
    .digest("base64url");
}

export function verifyProjectStatusSession(candidate: string | undefined): boolean {
  const expected = createProjectStatusSessionToken();
  return Boolean(candidate && expected && matches(candidate, expected));
}
