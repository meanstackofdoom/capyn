# @capyn/gate

`@capyn/gate` provides the cryptographic boundary between a CAPYN authority
decision and a consequential provider call.

It issues and verifies short-lived ES256 execution claims that bind one
operation to the exact organisation, agent, mandate, authorization, execution
attempt and canonical action hash. `ExecutionGate` consumes each claim once
through an injected atomic replay store before provider execution may begin.

The included in-memory replay store and ephemeral key helper are for tests and
single-process demonstrations only. A production Gate must use durable atomic
replay storage, persistent KMS/HSM-managed signing keys, and an exclusive
downstream credential or role that the agent cannot bypass.
