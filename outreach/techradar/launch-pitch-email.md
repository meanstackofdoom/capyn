# Launch pitch email

## Subject options

Recommended:

```text
Built the agent authorization control plane your July piece describes
```

Alternatives:

```text
CAPYN: a working ALLOW / DENY / REQUIRE_APPROVAL layer for agents
Working demo: bounded spending authority before agent payments execute
From agent wallets to agent authority — an open developer MVP
```

## Plain-text draft

```text
Hi TechRadar Pro team,

Your 31 July piece, “The real fight in agentic commerce isn't autonomy. It's authorization,” described the operational question I've been working on: can a business prove what an agent was allowed to do, by whom, and under which constraints?

I've now built and open-sourced the first developer MVP of CAPYN, an authority control plane that sits before payment execution.

The demo is deliberately narrow. An authenticated procurement agent requests one action, and CAPYN returns ALLOW, DENY or REQUIRE_APPROVAL after checking its mandate, capability, vendor, hard limits, current daily/monthly spend and human-review threshold.

The short demo shows:

- $18 to OpenAI → ALLOW
- $30 to an unknown vendor → DENY
- $120 to AWS → REQUIRE_APPROVAL
- transfer.wallet → DENY

The less visible work is the part I think matters: request-bound approvals, idempotency, replay prevention, integer money accounting, explainable reason traces, serialized spend reservations and race-safe approval decisions.

CAPYN is not another wallet or payment rail. The policy layer is chain-agnostic and designed to sit above x402, Solana/USDC, AP2, Stripe or another executor.

Repository: https://github.com/meanstackofdoom/capyn
Live synthetic demo: https://capyn-production.up.railway.app
24-second demo: https://github.com/meanstackofdoom/capyn/releases/download/v0.1.0/capyn-public-alpha.mp4
Technical note: https://github.com/meanstackofdoom/capyn/blob/v0.1.0/docs/agent-authority-problem.md

I'm Matthew Wicks, an independent builder in Australia. If this would be useful for a follow-up on what authorization infrastructure looks like in working code, I'd be glad to give you a short demo or answer technical questions. I can also share the concurrency threat model and the limits I have intentionally left unresolved in v0.1.

Best,
Matthew Wicks
https://github.com/meanstackofdoom/capyn
```

## Final edit

Send from Matthew's preferred public contact address, keep the draft below roughly 250 words, and remove any sentence he would not naturally say. Verify every technical claim against the current release before sending.
