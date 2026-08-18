import type { ExecutionRequest, PaymentExecutionResult, PaymentExecutor } from "@capyn/gate";
import { z } from "zod";

export const AWS_EC2_DRY_RUN_CAPABILITY = "aws.ec2.run-instances.dry-run";
export const AWS_EC2_DRY_RUN_PROVIDER = "aws-ec2-dry-run";

export const awsEc2DryRunBlueprintSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{2,79}$/),
    region: z.string().regex(/^[a-z]{2}(?:-gov)?-[a-z]+-\d$/),
    instanceType: z.string().regex(/^[a-z0-9][a-z0-9.]{1,39}$/),
    imageFamily: z.literal("al2023"),
    instanceCount: z.literal(1),
    maxMonthlyCostMinor: z.string().regex(/^[1-9]\d{0,13}$/)
  })
  .strict();

export type AwsEc2DryRunBlueprint = z.infer<typeof awsEc2DryRunBlueprintSchema>;

export const awsEc2DryRunMetadataSchema = z
  .object({
    mode: z.literal("DRY_RUN"),
    environment: z.literal("sandbox"),
    blueprintId: z.string().regex(/^[a-z0-9][a-z0-9-]{2,79}$/),
    region: z.string().regex(/^[a-z]{2}(?:-gov)?-[a-z]+-\d$/),
    instanceCount: z.literal(1),
    purpose: z.string().trim().min(3).max(240)
  })
  .strict();

function failed(errorCode: string): PaymentExecutionResult {
  return { status: "FAILED", reference: null, errorCode };
}

export class AwsEc2DryRunExecutor implements PaymentExecutor {
  readonly name = AWS_EC2_DRY_RUN_PROVIDER;
  private readonly blueprints: ReadonlyMap<string, AwsEc2DryRunBlueprint>;

  constructor(blueprints: readonly AwsEc2DryRunBlueprint[]) {
    const parsed = z.array(awsEc2DryRunBlueprintSchema).min(1).max(20).parse(blueprints);
    const entries = parsed.map((blueprint) => [blueprint.id, blueprint] as const);
    if (new Set(entries.map(([id]) => id)).size !== entries.length) {
      throw new Error("AWS dry-run blueprint IDs must be unique");
    }
    this.blueprints = new Map(entries);
  }

  async execute(request: ExecutionRequest): Promise<PaymentExecutionResult> {
    return this.evaluate(request);
  }

  async reconcile(request: ExecutionRequest): Promise<PaymentExecutionResult> {
    return this.evaluate(request);
  }

  private evaluate(request: ExecutionRequest): PaymentExecutionResult {
    if (request.capability !== AWS_EC2_DRY_RUN_CAPABILITY) {
      return failed("AWS_DRY_RUN_CAPABILITY_REQUIRED");
    }
    if (request.vendor.id !== "aws") return failed("AWS_VENDOR_REQUIRED");
    const metadata = awsEc2DryRunMetadataSchema.safeParse(request.metadata);
    if (!metadata.success) return failed("AWS_DRY_RUN_METADATA_INVALID");
    const blueprint = this.blueprints.get(metadata.data.blueprintId);
    if (!blueprint) return failed("AWS_BLUEPRINT_NOT_ALLOWED");
    if (
      metadata.data.region !== blueprint.region ||
      metadata.data.instanceCount !== blueprint.instanceCount
    ) {
      return failed("AWS_BLUEPRINT_BOUNDARY_MISMATCH");
    }
    if (BigInt(request.amountMinor) > BigInt(blueprint.maxMonthlyCostMinor)) {
      return failed("AWS_PROJECTED_COST_EXCEEDS_BLUEPRINT");
    }
    return {
      status: "EXECUTED",
      reference: `aws_dry_run_${request.executionId}`,
      errorCode: null
    };
  }
}
