import { describe, expect, it } from "vitest";
import { executionActionHash, type ExecutionRequest } from "@capyn/gate";
import {
  AWS_EC2_DRY_RUN_CAPABILITY,
  AwsEc2DryRunExecutor,
  type AwsEc2DryRunBlueprint
} from "../src/providers/aws-ec2-dry-run";

const blueprint: AwsEc2DryRunBlueprint = {
  id: "capyn-t3-micro-v1",
  region: "ap-southeast-2",
  instanceType: "t3.micro",
  imageFamily: "al2023",
  instanceCount: 1,
  maxMonthlyCostMinor: "12000"
};

function request(overrides: Partial<ExecutionRequest> = {}): ExecutionRequest {
  const action = {
    capability: AWS_EC2_DRY_RUN_CAPABILITY,
    amountMinor: "12000",
    currency: "USD" as const,
    vendor: { id: "aws", name: "AWS" },
    metadata: {
      mode: "DRY_RUN",
      environment: "sandbox",
      blueprintId: blueprint.id,
      region: blueprint.region,
      instanceCount: 1,
      purpose: "Validate a capped compute request"
    }
  };
  return {
    executionId: "exe_aws_test",
    authorizationId: "aut_aws_test",
    organisationId: "org_aws_test",
    agentId: "agt_aws_test",
    mandateId: "man_aws_test",
    ...action,
    requestHash: executionActionHash(action),
    attemptCount: 1,
    ...overrides
  };
}

describe("AWS EC2 dry-run blueprint executor", () => {
  it("accepts only the fixed no-mutation blueprint and returns an explicit dry-run reference", async () => {
    const executor = new AwsEc2DryRunExecutor([blueprint]);
    await expect(executor.execute(request())).resolves.toEqual({
      status: "EXECUTED",
      reference: "aws_dry_run_exe_aws_test",
      errorCode: null
    });
  });

  it("fails closed on unknown blueprints, extra metadata, region drift, and cost drift", async () => {
    const executor = new AwsEc2DryRunExecutor([blueprint]);
    const base = request();

    await expect(executor.execute({
      ...base,
      metadata: { ...base.metadata, blueprintId: "unapproved-blueprint" }
    })).resolves.toMatchObject({ status: "FAILED", errorCode: "AWS_BLUEPRINT_NOT_ALLOWED" });
    await expect(executor.execute({
      ...base,
      metadata: { ...base.metadata, arbitraryApiCall: "ec2:TerminateInstances" }
    })).resolves.toMatchObject({ status: "FAILED", errorCode: "AWS_DRY_RUN_METADATA_INVALID" });
    await expect(executor.execute({
      ...base,
      metadata: { ...base.metadata, region: "us-east-1" }
    })).resolves.toMatchObject({ status: "FAILED", errorCode: "AWS_BLUEPRINT_BOUNDARY_MISMATCH" });
    await expect(executor.execute({ ...base, amountMinor: "12001" })).resolves.toMatchObject({
      status: "FAILED",
      errorCode: "AWS_PROJECTED_COST_EXCEEDS_BLUEPRINT"
    });
  });

  it("never accepts the live RunInstances capability", async () => {
    const executor = new AwsEc2DryRunExecutor([blueprint]);
    await expect(executor.execute(request({ capability: "aws.ec2.run-instances" }))).resolves.toMatchObject({
      status: "FAILED",
      errorCode: "AWS_DRY_RUN_CAPABILITY_REQUIRED"
    });
  });
});
