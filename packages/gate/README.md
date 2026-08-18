# @capyn/gate

`@capyn/gate` provides the cryptographic boundary between a CAPYN authority
decision and a consequential provider call.

It issues and verifies short-lived ES256 execution claims that bind one
operation to the exact organisation, agent, mandate, authorization, execution
attempt and canonical action hash. `ExecutionGate` consumes each claim once
through an injected atomic replay store before provider execution may begin.

`LocalExecutionGateway` keeps claim consumption and provider invocation in one
trust boundary. `HttpExecutionGateway` dispatches the same strict request to a
remote Gate, validates its result and receipt against the original claim, and
keeps transport loss distinguishable from definitive pre-provider rejection.

The included in-memory replay store and ephemeral key helper are for tests and
single-process demonstrations only. The monorepo's deployable Gate uses the
PostgreSQL replay adapter in `@capyn/database`; production must also use a
reviewed KMS/HSM signer and an exclusive downstream credential or role that the
agent and control API cannot bypass.
