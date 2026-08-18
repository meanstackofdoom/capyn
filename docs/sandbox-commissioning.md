# Sandbox commissioning

The public commissioning flow takes one visitor through the complete CAPYN trust loop: workspace, agent identity, mandate, bearer credential, policy decision and portable proof. It uses the same deterministic policy engine as the durable API while remaining deliberately synthetic and stateless.

Open the [live commissioning bay](https://capyn-production.up.railway.app/activate) or run the web and API services locally, then visit `http://localhost:3010/activate`.

## What the flow proves

The browser sends one bounded activation packet to `POST /v1/sandbox/activate`. The API validates the workspace, agent, mandate, ordered USD limits and first exact action. It returns a short-lived `capyn_sbx_…` bearer credential.

The browser then sends only the exact action plus that bearer to `POST /v1/sandbox/authorize`. CAPYN recovers the authenticated agent and sealed mandate from the credential, constructs a normal `PolicyEvaluationInput`, runs `@capyn/policy-engine`, and returns `ALLOW`, `DENY` or `REQUIRE_APPROVAL` with the rule trace and SHA-256-covered evidence.

This demonstrates an important invariant: the authorization body cannot choose or replace the agent identity.

## Credential design

The sandbox credential is a versioned, authenticated AES-256-GCM envelope. Its encryption key is domain-separated and derived from the deployment's high-entropy `API_KEY_PEPPER`. The envelope carries:

- issue and expiry timestamps;
- ephemeral workspace and agent identifiers;
- the agent display name and stable slug;
- the exact capability, vendor set and ordered mandate limits.

The envelope is authenticated before it is parsed. Invalid, malformed and modified values all return the same generic `401 UNAUTHENTICATED` response. An authentic credential older than 30 minutes returns `410 SANDBOX_CREDENTIAL_EXPIRED`.

The plaintext credential is returned once and held only in React memory. The page does not write it to local storage, a cookie or the URL. Refreshing or clearing the page discards the browser copy.

## Deliberate sandbox boundaries

The flow creates no organisation, agent, mandate, credential, authorization or spend record in the repository. It moves no funds and does not invoke a configured execution adapter. `ALLOW` reaches only a synthetic executor event.

Because the credential is stateless:

- it cannot be individually revoked before its 30-minute expiry;
- repeated decisions do not accumulate daily or monthly spend;
- `REQUIRE_APPROVAL` stops at a human checkpoint and has no public approval-resolution route;
- evidence demonstrates canonical receipt integrity, not a signature or durable audit record;
- availability is bounded by process-local IP rate limits and carries no service-level promise.

These are explicit public-demo properties, not the production credential model. Durable CAPYN workspaces store only HMAC hashes of revocable agent credentials, reserve spend, persist audit evidence and bind approvals and execution to exact authorization records.

## HTTP contract

Activation is limited to ten requests per minute per resolved client IP. Authorization is limited to sixty requests per minute. Both accept strict objects and reject injected fields.

```bash
curl -X POST "$CAPYN_API_URL/v1/sandbox/activate" \
  -H "Content-Type: application/json" \
  -d @activation.json
```

Store the returned key in a temporary shell variable, then submit the exact action:

```bash
curl -X POST "$CAPYN_API_URL/v1/sandbox/authorize" \
  -H "Authorization: Bearer $CAPYN_SANDBOX_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "capability": "spend.compute",
    "amount": { "value": "18.00", "currency": "USD" },
    "vendor": { "id": "openai", "name": "OpenAI" },
    "purpose": "Inference capacity for a customer workflow"
  }'
```

See [REST API](api.md) for response semantics, [Security](security.md) for the wider threat boundary and [Getting started](getting-started.md) for the local topology.

## Verification coverage

API tests cover issuance without persistence, authenticated identity recovery, all three decisions, hard ceilings, malformed and injected input, tampered keys and expiry. Web tests cover draft validation, limit ordering, slug normalization, deterministic stress scenarios and credential-free curl output. Production and combined-service smoke gates commission an agent and prove its first digest-covered decision through built artifacts.
