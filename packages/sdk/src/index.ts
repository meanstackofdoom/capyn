import {
  authorizationResultSchema,
  type ApiErrorBody,
  type AuthorizationResult,
  type AuthorizationView,
  type AuthorizeRequest,
  type ExecutionResultView,
  type MandatePolicyContext
} from "@capyn/types";

export interface CapynOptions {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
}

export interface AuthorizeOptions {
  idempotencyKey?: string;
}

export class CapynApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId?: string
  ) {
    super(message);
    this.name = "CapynApiError";
  }
}

function createIdempotencyKey(): string {
  return `sdk-${globalThis.crypto.randomUUID()}`;
}

export class Capyn {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetcher: typeof globalThis.fetch;

  constructor(options: CapynOptions) {
    if (!options.apiKey.startsWith("capyn_")) throw new Error("A CAPYN API key is required");
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "http://localhost:4000").replace(/\/$/, "");
    this.fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async authorize(request: AuthorizeRequest, options: AuthorizeOptions = {}): Promise<AuthorizationResult> {
    const result = await this.request<unknown>("POST", "/v1/authorize", request, {
      "Idempotency-Key": options.idempotencyKey ?? createIdempotencyKey()
    });
    return authorizationResultSchema.parse(result);
  }

  async me(): Promise<{
    id: string;
    organisationId: string;
    name: string;
    slug: string;
    description: string | null;
    status: string;
    activeMandateId: string | null;
  }> {
    return this.request("GET", "/v1/me");
  }

  async mandate(): Promise<MandatePolicyContext | null> {
    const result = await this.request<{ mandate: MandatePolicyContext | null }>("GET", "/v1/mandate");
    return result.mandate;
  }

  async authorization(id: string): Promise<AuthorizationView> {
    return this.request("GET", `/v1/authorizations/${encodeURIComponent(id)}`);
  }

  async execute(id: string): Promise<ExecutionResultView> {
    return this.request("POST", `/v1/authorizations/${encodeURIComponent(id)}/execute`);
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
    extraHeaders: Record<string, string> = {}
  ): Promise<T> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...extraHeaders
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = payload as Partial<ApiErrorBody> | null;
      throw new CapynApiError(
        response.status,
        error?.error?.code ?? "CAPYN_REQUEST_FAILED",
        error?.error?.message ?? `CAPYN request failed with status ${response.status}`,
        error?.error?.requestId
      );
    }
    return payload as T;
  }
}

export type {
  AuthorizationResult,
  AuthorizationView,
  AuthorizeRequest,
  ExecutionResultView,
  MandatePolicyContext
} from "@capyn/types";
