import { afterEach, describe, expect, it, vi } from "vitest";
import { requireSignedReceiptGateHealth } from "../src/remote-gate-health";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("remote Gate startup health check", () => {
  it("passes when Gate reports receipt signing is enabled", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        status: "ok",
        service: "capyn-gate",
        version: "0.4.0",
        receiptSigningEnabled: true
      }), { status: 200 })
    );
    globalThis.fetch = mockFetch as typeof fetch;

    await expect(requireSignedReceiptGateHealth("https://gate.internal.local")).resolves.toBeUndefined();
    const called = mockFetch.mock.calls.at(0)?.[0];
    expect(new URL(String(called))).toMatchObject({ pathname: "/healthz" });
  });

  it("rejects when Gate reports signed receipts as disabled", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: "ok",
      service: "capyn-gate",
      version: "0.4.0",
      receiptSigningEnabled: false
    }), { status: 200 })) as typeof fetch;

    await expect(requireSignedReceiptGateHealth("https://gate.internal.local")).rejects.toThrow(
      "does not report signed-receipt readiness"
    );
  });

  it("rejects malformed Gate health payloads", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 })) as typeof fetch;

    await expect(requireSignedReceiptGateHealth("https://gate.internal.local")).rejects.toThrow(
      "does not report signed-receipt readiness"
    );
  });

  it("rejects unhealthy HTTP responses", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("nope", { status: 503 })) as typeof fetch;

    await expect(requireSignedReceiptGateHealth("https://gate.internal.local")).rejects.toThrow(
      "Execution Gate health check failed with HTTP 503"
    );
  });
});
