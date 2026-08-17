import type {
  AgentStatus,
  ApprovalView,
  AuditEventView,
  AuthorizationState,
  BillableMetric,
  BillingPlanId,
  BillingProviderName,
  DashboardSnapshot,
  Decision,
  JsonValue,
  MandatePolicyContext,
  PolicyEvaluationInput,
  ReasonCode,
  RuleTrace,
  SubscriptionStatus,
  UserRole
} from "@capyn/types";

export interface CredentialAuthRecord {
  id: string;
  keyHash: string;
  organisationId: string;
  agentId: string;
  revokedAt: Date | null;
}

export interface StoredCredential {
  id: string;
  agentId: string;
  keyPrefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  rotationIdempotencyKey: string | null;
  rotatedFromId: string | null;
}

export interface UserAuthRecord {
  id: string;
  organisationId: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface AgentRecord {
  id: string;
  organisationId: string;
  name: string;
  slug: string;
  description: string | null;
  status: AgentStatus;
  createdAt: Date;
}

export interface StoredAuthorization {
  id: string;
  organisationId: string;
  agentId: string;
  agentName: string;
  mandateId: string | null;
  idempotencyKey: string;
  requestHash: string;
  capability: string;
  amountMinor: string;
  currency: "USD";
  vendorId: string;
  vendorName: string | null;
  metadata: Record<string, JsonValue>;
  decision: Decision;
  state: AuthorizationState;
  reasonCodes: ReasonCode[];
  trace: RuleTrace[];
  approvalId: string | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
}

export interface StoredApproval {
  id: string;
  organisationId: string;
  authorizationId: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  triggeredBy: ReasonCode;
  requestedAt: Date;
  decidedAt: Date | null;
  decidedBy: string | null;
  comment: string | null;
}

export interface StoredExecution {
  id: string;
  organisationId: string;
  authorizationId: string;
  status: "PENDING" | "EXECUTED" | "FAILED";
  provider: string;
  externalReference: string | null;
  errorCode: string | null;
  attemptCount: number;
  lastAttemptAt: Date;
  leaseExpiresAt: Date | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface CreateAuthorizationRecord {
  id: string;
  organisationId: string;
  agentId: string;
  mandateId: string | null;
  idempotencyKey: string;
  requestHash: string;
  capability: string;
  amountMinor: string;
  currency: "USD";
  vendorId: string;
  vendorName: string | null;
  metadata: Record<string, JsonValue>;
  decision: Decision;
  state: AuthorizationState;
  reasonCodes: ReasonCode[];
  trace: RuleTrace[];
  expiresAt: Date | null;
}

export interface CreateApprovalRecord {
  id: string;
  organisationId: string;
  authorizationId: string;
  triggeredBy: ReasonCode;
}

export interface CreateExecutionRecord {
  id: string;
  organisationId: string;
  authorizationId: string;
  provider: string;
  attemptedAt: Date;
  leaseExpiresAt: Date;
}

export interface AppendAuditEvent {
  id: string;
  organisationId: string;
  actorType: "USER" | "AGENT" | "SYSTEM";
  actorId: string | null;
  eventType: string;
  entityType: string;
  entityId: string;
  timestamp: Date;
  metadata: Record<string, JsonValue>;
}

export interface CreateAgentRecord {
  id: string;
  organisationId: string;
  name: string;
  slug: string;
  description: string | null;
}

export interface CreateCredentialRecord {
  id: string;
  agentId: string;
  keyPrefix: string;
  keyHash: string;
  rotationIdempotencyKey?: string | null;
  rotatedFromId?: string | null;
}

export interface CreateMandateRecord {
  id: string;
  policyId: string;
  organisationId: string;
  agentId: string;
  name: string;
  validFrom: Date;
  validUntil: Date;
  createdBy: string;
  capabilities: string[];
  allowedVendors: Array<{ id: string; name: string | null }>;
  currency: "USD";
  perTransactionLimitMinor: string;
  dailyLimitMinor: string;
  monthlyLimitMinor: string;
  approvalThresholdMinor: string;
}

export interface CreateOrganisationRecord {
  organisation: { id: string; name: string; slug: string };
  owner: { id: string; name: string; email: string };
  subscription: { id: string; currentPeriodStart: Date; currentPeriodEnd: Date };
}

export interface StoredSubscription {
  id: string;
  organisationId: string;
  planId: BillingPlanId;
  status: SubscriptionStatus;
  provider: BillingProviderName;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

export interface BillingAllowance {
  subscription: StoredSubscription;
  activeAgents: number;
  authorizationDecisions: number;
}

export interface BillingAccountRecord extends BillingAllowance {
  approvalRequests: number;
  auditEvents: number;
  integrationConnections: number;
}

export interface RecordBillingUsage {
  id: string;
  organisationId: string;
  metric: BillableMetric;
  quantity: string;
  sourceType: string;
  sourceId: string;
  occurredAt: Date;
  metadata: Record<string, JsonValue>;
}

export interface UpdateSubscriptionRecord {
  organisationId: string;
  planId: BillingPlanId;
  status: SubscriptionStatus;
  provider: BillingProviderName;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

export interface RecordBillingWebhook {
  id: string;
  provider: BillingProviderName;
  providerEventId: string;
  eventType: string;
  payloadHash: string;
  receivedAt: Date;
  processedAt: Date;
}

export interface CapynTransaction {
  lockAgent(agentId: string): Promise<void>;
  lockOrganisation(organisationId: string): Promise<void>;
  findAgent(agentId: string): Promise<AgentRecord | null>;
  findCredential(agentId: string, credentialId: string): Promise<StoredCredential | null>;
  findCredentialRotation(agentId: string, idempotencyKey: string): Promise<StoredCredential | null>;
  findIdempotentAuthorization(agentId: string, idempotencyKey: string): Promise<StoredAuthorization | null>;
  loadPolicyContext(agentId: string, currency: "USD", now: Date): Promise<Omit<PolicyEvaluationInput, "request" | "approvalAlreadyGranted">>;
  createAuthorization(input: CreateAuthorizationRecord): Promise<StoredAuthorization>;
  findAuthorization(id: string): Promise<StoredAuthorization | null>;
  updateAuthorization(
    id: string,
    update: { state: AuthorizationState; expiresAt?: Date | null }
  ): Promise<StoredAuthorization>;
  createApproval(input: CreateApprovalRecord): Promise<StoredApproval>;
  findApproval(id: string): Promise<StoredApproval | null>;
  updateApproval(
    id: string,
    update: {
      status: "APPROVED" | "REJECTED" | "EXPIRED";
      decidedAt: Date;
      decidedBy: string | null;
      comment: string | null;
    }
  ): Promise<StoredApproval>;
  findExecutionByAuthorization(authorizationId: string): Promise<StoredExecution | null>;
  createExecution(input: CreateExecutionRecord): Promise<StoredExecution>;
  claimExecutionRecovery(
    id: string,
    attemptedAt: Date,
    leaseExpiresAt: Date
  ): Promise<StoredExecution | null>;
  markExecutionUncertain(
    id: string,
    expectedAttemptCount: number,
    update: {
      externalReference: string | null;
      errorCode: string;
      leaseExpiresAt: Date;
    }
  ): Promise<StoredExecution | null>;
  completeExecution(
    id: string,
    expectedAttemptCount: number,
    update: {
      status: "EXECUTED" | "FAILED";
      externalReference: string | null;
      errorCode: string | null;
      completedAt: Date;
    }
  ): Promise<StoredExecution | null>;
  appendAudit(input: AppendAuditEvent): Promise<void>;
  createAgent(input: CreateAgentRecord): Promise<AgentRecord>;
  updateAgentStatus(agentId: string, status: AgentStatus): Promise<AgentRecord>;
  createCredential(input: CreateCredentialRecord): Promise<void>;
  revokeCredential(credentialId: string, agentId: string, at: Date): Promise<boolean>;
  revokeAgentCredentials(agentId: string, at: Date): Promise<number>;
  createActiveMandate(input: CreateMandateRecord): Promise<{ id: string; version: number }>;
  revokeActiveMandates(agentId: string, at: Date): Promise<number>;
  createOrganisation(input: CreateOrganisationRecord): Promise<{ organisationId: string; ownerId: string }>;
  getBillingAllowance(organisationId: string, now: Date): Promise<BillingAllowance>;
  recordBillingUsage(input: RecordBillingUsage): Promise<void>;
  updateSubscription(input: UpdateSubscriptionRecord): Promise<StoredSubscription>;
  recordBillingWebhook(input: RecordBillingWebhook): Promise<boolean>;
}

export interface CapynRepository {
  findCredentialByHash(keyHash: string): Promise<CredentialAuthRecord | null>;
  touchCredential(id: string, at: Date): Promise<void>;
  findUser(id: string): Promise<UserAuthRecord | null>;
  transaction<T>(work: (tx: CapynTransaction) => Promise<T>): Promise<T>;
  getDashboardSnapshot(organisationId: string, now: Date): Promise<DashboardSnapshot | null>;
  getApprovalView(organisationId: string, approvalId: string): Promise<ApprovalView | null>;
  getAuditEvents(organisationId: string, limit: number): Promise<AuditEventView[]>;
  getBillingAccount(organisationId: string, now: Date): Promise<BillingAccountRecord | null>;
}

export interface DemoSeedIds {
  organisationId: string;
  ownerId: string;
  approverId: string;
  agentId: string;
  credentialId: string;
  mandateId: string;
  demoApiKey: string;
}

export type PolicyContextRecord = Omit<PolicyEvaluationInput, "request" | "approvalAlreadyGranted"> & {
  mandate: MandatePolicyContext | null;
};
