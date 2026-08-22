export interface RemoteGateHealth {
  status: string;
  service: string;
  version: string;
  receiptSigningEnabled: boolean;
}

const REMOTE_GATE_HEALTH_TIMEOUT_MS = 5_000;

function isRemoteGateHealth(value: unknown): value is RemoteGateHealth {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.status === "string" &&
    typeof candidate.service === "string" &&
    typeof candidate.version === "string" &&
    candidate.receiptSigningEnabled === true
  );
}

export async function requireSignedReceiptGateHealth(gateUrl: string): Promise<void> {
  const response = await fetch(new URL("healthz", gateUrl), {
    signal: AbortSignal.timeout(REMOTE_GATE_HEALTH_TIMEOUT_MS)
  });
  if (!response.ok) {
    throw new Error(`Execution Gate health check failed with HTTP ${response.status}`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("Execution Gate health check returned invalid JSON");
  }

  if (!isRemoteGateHealth(body)) {
    throw new Error("Execution Gate health check does not report signed-receipt readiness");
  }
}

