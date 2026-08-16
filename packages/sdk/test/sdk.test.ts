import { describe, expect, it, vi } from "vitest";
import { Capyn, CapynApiError } from "../src/index";

const request = {
  capability: "spend.compute",
  amount: { value: "18.42", currency: "USD" as const },
  vendor: { id: "openai" },
  metadata: { purpose: "Purchase inference capacity" }
};

describe("Capyn SDK", () => {
  it("sends an authenticated, idempotent authorization request", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          decision: "ALLOW",
          authorizationId: "auth_1",
          reasonCodes: ["CAPABILITY_ALLOWED"],
          reasons: [{ code: "CAPABILITY_ALLOWED", description: "Allowed" }],
          expiresAt: "2026-08-16T10:15:00.000Z"
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    const capyn = new Capyn({ apiKey: "capyn_test_secret", baseUrl: "https://api.capyn.test/", fetch: fetcher });
    const result = await capyn.authorize(request, { idempotencyKey: "order-12345678" });
    expect(result.decision).toBe("ALLOW");
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.capyn.test/v1/authorize",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer capyn_test_secret",
          "Idempotency-Key": "order-12345678"
        })
      })
    );
  });

  it("returns typed API errors without exposing the key", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "VENDOR_NOT_ALLOWED", message: "Vendor is not approved" } }), {
        status: 403,
        headers: { "content-type": "application/json" }
      })
    );
    const capyn = new Capyn({ apiKey: "capyn_test_do-not-leak", fetch: fetcher });
    const error = await capyn.authorize(request).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CapynApiError);
    expect(String(error)).not.toContain("do-not-leak");
  });
});
