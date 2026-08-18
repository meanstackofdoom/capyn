import type { AddressInfo } from "node:net";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import {
  HttpExecutionGateway,
  LocalExecutionGateway,
  createEphemeralExecutionAuthority
} from "@capyn/gate";
import type { AuthorizationResult, ExecutionResultView } from "@capyn/types";
import { buildGateApp } from "../../gate/src/app";
import {
  AWS_EC2_DRY_RUN_CAPABILITY,
  AwsEc2DryRunExecutor
} from "../../gate/src/providers/aws-ec2-dry-run";
import { agentHeaders, createTestContext, TEST_NOW } from "./helpers";

const CONTROL_TOKEN = "capyn-gate-control-token-at-least-32-characters";
const openApps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

describe("control plane to remote Gate", () => {
  it("crosses the HTTP authority boundary before the AWS dry-run adapter", async () => {
    const authority = createEphemeralExecutionAuthority({
      issuer: "urn:capyn:control:remote-test",
      audience: "urn:capyn:gate:aws-remote-test",
      clock: () => TEST_NOW
    });
    const provider = new AwsEc2DryRunExecutor([{
      id: "capyn-t3-micro-v1",
      region: "ap-southeast-2",
      instanceType: "t3.micro",
      imageFamily: "al2023",
      instanceCount: 1,
      maxMonthlyCostMinor: "12000"
    }]);
    const gate = await buildGateApp({
      gateway: new LocalExecutionGateway({
        gateId: "gate-aws-remote-test",
        gate: authority.gate,
        executor: provider,
        clock: () => TEST_NOW
      }),
      controlToken: CONTROL_TOKEN,
      logger: false,
      disableRateLimit: true
    });
    openApps.push(gate);
    await gate.listen({ port: 0, host: "127.0.0.1" });
    const address = gate.server.address() as AddressInfo;
    const gateway = new HttpExecutionGateway({
      baseUrl: `http://127.0.0.1:${address.port}`,
      controlToken: CONTROL_TOKEN,
      providerName: provider.name,
      expectedGateId: "gate-aws-remote-test"
    });
    const context = await createTestContext({ executionAuthority: { issuer: authority.issuer, gateway } });
    openApps.push(context.app);

    const authorizationResponse = await context.app.inject({
      method: "POST",
      url: "/v1/authorize",
      headers: agentHeaders("remote-gate-authorize-0001"),
      payload: {
        capability: AWS_EC2_DRY_RUN_CAPABILITY,
        amount: { value: "18.00", currency: "USD" },
        vendor: { id: "aws", name: "AWS" },
        metadata: {
          mode: "DRY_RUN",
          environment: "sandbox",
          blueprintId: "capyn-t3-micro-v1",
          region: "ap-southeast-2",
          instanceCount: 1,
          purpose: "Validate an $18 sandbox compute envelope"
        }
      }
    });
    expect(authorizationResponse.statusCode, authorizationResponse.body).toBe(200);
    const authorization = authorizationResponse.json<AuthorizationResult>();
    expect(authorization.decision).toBe("ALLOW");

    const executionResponse = await context.app.inject({
      method: "POST",
      url: `/v1/authorizations/${authorization.authorizationId}/execute`,
      headers: { authorization: agentHeaders("remote-gate-execute-0001").authorization }
    });
    expect(executionResponse.statusCode, executionResponse.body).toBe(200);
    expect(executionResponse.json<ExecutionResultView>()).toMatchObject({
      status: "EXECUTED",
      provider: "aws-ec2-dry-run"
    });

    const recorded = context.repository.inspect().auditEvents.find((event) => event.eventType === "EXECUTION_RECORDED");
    expect(recorded?.metadata).toMatchObject({
      gateId: "gate-aws-remote-test",
      authorityOperation: "EXECUTE"
    });
    expect(recorded?.metadata["gateReceiptHash"]).toMatch(/^[a-f0-9]{64}$/);
  });
});
