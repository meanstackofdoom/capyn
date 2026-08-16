import type {
  PolicyEvaluation,
  PolicyEvaluationInput,
  ReasonCode,
  RuleTrace
} from "@capyn/types";

interface ParsedNumbers {
  amount: bigint;
  transactionLimit: bigint;
  dailyLimit: bigint;
  monthlyLimit: bigint;
  approvalThreshold: bigint;
  dailySpend: bigint;
  monthlySpend: bigint;
}

function parseNonNegative(value: string): bigint | null {
  if (!/^\d+$/.test(value)) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function configurationFailure(details: string): PolicyEvaluation {
  return {
    decision: "DENY",
    reasonCodes: ["POLICY_CONFIGURATION_ERROR"],
    trace: [
      {
        rule: "configuration",
        result: "FAIL",
        reasonCode: "POLICY_CONFIGURATION_ERROR",
        details: { error: details }
      }
    ]
  };
}

function parseConfiguration(input: PolicyEvaluationInput): ParsedNumbers | PolicyEvaluation {
  const { mandate, request, spend } = input;
  if (input.activeMandateCount > 1) return configurationFailure("multiple active mandates");
  if (!mandate?.policy) return configurationFailure("active mandate has no spending policy");
  if (mandate.policy.currency !== request.currency) return configurationFailure("currency does not match policy");

  const amount = parseNonNegative(request.amountMinor);
  const transactionLimit = parseNonNegative(mandate.policy.perTransactionLimitMinor);
  const dailyLimit = parseNonNegative(mandate.policy.dailyLimitMinor);
  const monthlyLimit = parseNonNegative(mandate.policy.monthlyLimitMinor);
  const approvalThreshold = parseNonNegative(mandate.policy.approvalThresholdMinor);
  const dailySpend = parseNonNegative(spend.dailyMinor);
  const monthlySpend = parseNonNegative(spend.monthlyMinor);

  if (
    amount === null ||
    transactionLimit === null ||
    dailyLimit === null ||
    monthlyLimit === null ||
    approvalThreshold === null ||
    dailySpend === null ||
    monthlySpend === null
  ) {
    return configurationFailure("money values must be non-negative integer minor units");
  }
  if (amount === 0n) return configurationFailure("request amount must be positive");
  if (transactionLimit === 0n || dailyLimit === 0n || monthlyLimit === 0n) {
    return configurationFailure("hard limits must be positive");
  }
  if (transactionLimit > dailyLimit || dailyLimit > monthlyLimit) {
    return configurationFailure("limits must satisfy transaction <= daily <= monthly");
  }
  if (approvalThreshold > transactionLimit) {
    return configurationFailure("approval threshold cannot exceed the hard transaction limit");
  }
  if (!mandate.policy.allowedVendorIds.length) return configurationFailure("vendor allowlist is empty");
  if (!mandate.capabilities.length) return configurationFailure("capability grant is empty");

  return {
    amount,
    transactionLimit,
    dailyLimit,
    monthlyLimit,
    approvalThreshold,
    dailySpend,
    monthlySpend
  };
}

function isEvaluation(value: ParsedNumbers | PolicyEvaluation): value is PolicyEvaluation {
  return "decision" in value;
}

function trace(
  rule: string,
  passed: boolean,
  passCode: ReasonCode,
  failCode: ReasonCode,
  details?: Record<string, string>
): RuleTrace {
  return {
    rule,
    result: passed ? "PASS" : "FAIL",
    reasonCode: passed ? passCode : failCode,
    ...(details ? { details } : {})
  };
}

function safeTime(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Evaluates one authorization request. It is deterministic, side-effect free and
 * deliberately fail-closed. Callers must load spend totals under a transaction
 * lock before invoking it.
 */
export function evaluatePolicy(input: PolicyEvaluationInput): PolicyEvaluation {
  if (!Number.isInteger(input.activeMandateCount) || input.activeMandateCount < 0) {
    return configurationFailure("invalid active mandate count");
  }
  if (input.activeMandateCount > 1) {
    return configurationFailure("multiple active mandates");
  }

  const now = safeTime(input.now);
  if (now === null) return configurationFailure("invalid evaluation time");

  const traces: RuleTrace[] = [];
  const failures: ReasonCode[] = [];

  const agentActive = input.agent.status === "ACTIVE";
  traces.push(trace("agentStatus", agentActive, "AGENT_ACTIVE", "AGENT_INACTIVE"));
  if (!agentActive) failures.push("AGENT_INACTIVE");

  const hasMandate = input.activeMandateCount === 1 && input.mandate?.status === "ACTIVE";
  traces.push(trace("mandate", hasMandate, "ACTIVE_MANDATE_FOUND", "NO_ACTIVE_MANDATE"));
  if (!hasMandate || !input.mandate) {
    failures.push("NO_ACTIVE_MANDATE");
    return { decision: "DENY", reasonCodes: failures, trace: traces };
  }

  const validFrom = safeTime(input.mandate.validFrom);
  const validUntil = safeTime(input.mandate.validUntil);
  if (validFrom === null || validUntil === null || validFrom >= validUntil) {
    return configurationFailure("invalid mandate validity window");
  }

  const started = now >= validFrom;
  const unexpired = now < validUntil;
  if (!started) {
    traces.push({ rule: "expiry", result: "FAIL", reasonCode: "MANDATE_NOT_YET_VALID" });
    failures.push("MANDATE_NOT_YET_VALID");
  } else if (!unexpired) {
    traces.push({ rule: "expiry", result: "FAIL", reasonCode: "MANDATE_EXPIRED" });
    failures.push("MANDATE_EXPIRED");
  } else {
    traces.push({
      rule: "expiry",
      result: "PASS",
      reasonCode: "MANDATE_VALID",
      details: { validUntil: input.mandate.validUntil }
    });
  }

  const parsed = parseConfiguration(input);
  if (isEvaluation(parsed)) return parsed;

  const capabilityAllowed = input.mandate.capabilities.includes(input.request.capability);
  traces.push(
    trace("capability", capabilityAllowed, "CAPABILITY_ALLOWED", "CAPABILITY_NOT_GRANTED", {
      requested: input.request.capability
    })
  );
  if (!capabilityAllowed) failures.push("CAPABILITY_NOT_GRANTED");

  const normalizedVendors = new Set(input.mandate.policy!.allowedVendorIds.map((id) => id.toLowerCase()));
  const vendorAllowed = normalizedVendors.has(input.request.vendor.id.toLowerCase());
  traces.push(
    trace("vendor", vendorAllowed, "VENDOR_ALLOWED", "VENDOR_NOT_ALLOWED", {
      vendorId: input.request.vendor.id
    })
  );
  if (!vendorAllowed) failures.push("VENDOR_NOT_ALLOWED");

  const transactionAllowed = parsed.amount <= parsed.transactionLimit;
  traces.push(
    trace("transactionLimit", transactionAllowed, "TRANSACTION_LIMIT_OK", "TRANSACTION_LIMIT_EXCEEDED", {
      amountMinor: parsed.amount.toString(),
      limitMinor: parsed.transactionLimit.toString()
    })
  );
  if (!transactionAllowed) failures.push("TRANSACTION_LIMIT_EXCEEDED");

  const projectedDaily = parsed.dailySpend + parsed.amount;
  const dailyAllowed = projectedDaily <= parsed.dailyLimit;
  traces.push(
    trace("dailyLimit", dailyAllowed, "DAILY_LIMIT_OK", "DAILY_LIMIT_EXCEEDED", {
      currentSpendMinor: parsed.dailySpend.toString(),
      projectedSpendMinor: projectedDaily.toString(),
      limitMinor: parsed.dailyLimit.toString()
    })
  );
  if (!dailyAllowed) failures.push("DAILY_LIMIT_EXCEEDED");

  const projectedMonthly = parsed.monthlySpend + parsed.amount;
  const monthlyAllowed = projectedMonthly <= parsed.monthlyLimit;
  traces.push(
    trace("monthlyLimit", monthlyAllowed, "MONTHLY_LIMIT_OK", "MONTHLY_LIMIT_EXCEEDED", {
      currentSpendMinor: parsed.monthlySpend.toString(),
      projectedSpendMinor: projectedMonthly.toString(),
      limitMinor: parsed.monthlyLimit.toString()
    })
  );
  if (!monthlyAllowed) failures.push("MONTHLY_LIMIT_EXCEEDED");

  const needsApproval = parsed.amount > parsed.approvalThreshold;
  traces.push({
    rule: "approvalThreshold",
    result: needsApproval && !input.approvalAlreadyGranted ? "REVIEW" : "PASS",
    reasonCode:
      needsApproval && !input.approvalAlreadyGranted ? "APPROVAL_THRESHOLD_EXCEEDED" : "APPROVAL_NOT_REQUIRED",
    details: {
      amountMinor: parsed.amount.toString(),
      thresholdMinor: parsed.approvalThreshold.toString(),
      approvalAlreadyGranted: String(input.approvalAlreadyGranted)
    }
  });

  if (failures.length > 0) return { decision: "DENY", reasonCodes: failures, trace: traces };
  if (needsApproval && !input.approvalAlreadyGranted) {
    return {
      decision: "REQUIRE_APPROVAL",
      reasonCodes: ["APPROVAL_THRESHOLD_EXCEEDED"],
      trace: traces
    };
  }

  return {
    decision: "ALLOW",
    reasonCodes: traces.map((item) => item.reasonCode),
    trace: traces
  };
}
