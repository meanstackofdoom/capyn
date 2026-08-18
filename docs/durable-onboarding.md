# Durable onboarding

CAPYN v0.4 turns a verified, stateless sandbox commissioning session into one durable hosted-alpha workspace. The handoff preserves the agent identity and mandate limits that were already exercised; it does not widen authority or connect live execution.

## User journey

1. Commission an agent at `/activate` and run its first policy decision.
2. Choose **Create a durable workspace** from the proof stage.
3. Bind an owner name, email and unique workspace slug.
4. Select Developer, Team or Business plan intent.
5. Confirm key custody and the synthetic-execution boundary.
6. Commit the workspace and download the one-time recovery bundle.
7. Open the control plane with the owner key, or authenticate the imported agent with its separate agent key.

The four-stage launch instrument is deliberately an air gap: the source is an expiring encrypted sandbox claim, while the destination is the configured durable tenant repository. The public one-service alpha uses an atomic journal on its attached volume; the scale-out adapter uses PostgreSQL.

## HTTP contract

`POST /v1/onboarding/launch` requires:

```text
Authorization: Bearer capyn_sbx_…
Idempotency-Key: caller-generated-stable-key
Content-Type: application/json
```

```json
{
  "organisation": { "slug": "northstar-ops" },
  "owner": { "name": "Taylor Morgan", "email": "taylor@northstar.example" },
  "planIntent": "TEAM",
  "acknowledgements": {
    "keyCustody": true,
    "syntheticExecution": true
  }
}
```

The route is limited to three attempts per resolved client IP per hour. It returns `201` for the first committed write and `200` for an exact replay.

## Atomic write

One repository transaction creates:

- the organisation and bounded Developer subscription;
- the owner and owner-credential digest;
- the imported agent and agent-credential digest;
- a 30-day active mandate carrying the sandbox capabilities, vendors and monetary limits;
- the production-launch replay record; and
- five append-oriented audit events covering the workspace, credentials, agent and mandate.

The sandbox credential is HMAC-fingerprinted and can claim only one workspace. The idempotency key is bound to the exact sandbox credential and normalized request. Reusing it with drift returns `409 IDEMPOTENCY_CONFLICT`; attempting a second workspace with the same sandbox credential returns `409 SANDBOX_ALREADY_LAUNCHED`.

## Credential custody

The response contains two different plaintext credentials once:

- `capyn_owner_live_…` authenticates human control-plane requests for one owner and organisation;
- `capyn_live_…` authenticates one agent to the durable authorization API.

Both values are deterministically derived from separate HMAC domains so an exact idempotent replay can recover the same response without storing plaintext. The durable repository stores only the credential IDs, short prefixes and HMAC-SHA-256 digests. The recovery download contains both plaintext keys and should be moved into a secret manager, then deleted from the download device.

The browser keeps the owner key in `sessionStorage` only after the user explicitly opens the control plane. It is therefore scoped to the current tab and is removed by **End session**. CAPYN does not store the agent key in browser storage. Ending the browser session is not server-side revocation; owner-key rotation and recovery are still an alpha operations boundary. Agent keys can already be rotated or revoked from the authenticated control plane.

## Billing boundary

Developer activates without a payment method. Team and Business selection records plan intent and asks the configured billing provider for a hosted Checkout session. Paid entitlements do not activate from client intent or a Checkout redirect: the existing signed Stripe webhook must confirm the provider subscription.

If Stripe is not fully configured, onboarding still commits the durable workspace with Developer active and reports that checkout is pending. Billing state can stop a request at a hosted quota, but it cannot turn `DENY` into `ALLOW` or widen a mandate.

## Hosted-alpha boundary

Durable onboarding makes identity, policy state, credential digests, approvals, subscriptions and audit history persistent. It does **not** make the current mock executor a live-money adapter, create an SLA, certify the service, send email, or provide password recovery. Those boundaries remain explicit in [Security](security.md) and [Billing](billing.md).

## Verification

API tests cover atomic provisioning, plaintext-at-rest exclusion, owner and agent authentication, audit creation, exact replay, payload drift, one-claim enforcement, malformed input, tampered credentials and configured/unconfigured billing. Web tests cover launch defaults, validation, request construction, credential masking and recovery-bundle content. The combined production smoke runs the complete sandbox-to-workspace handoff through built artifacts.
