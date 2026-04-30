/**
 * HAIWAVE Central API client.
 *
 * The portal calls haiCore for all network operations:
 * - Participant CRUD
 * - Manifest exchange
 * - Trading relationships
 * - Behavioral scores
 * - Agent registration and status
 * - Go Fish (network directory)
 *
 * The portal does NOT directly access the central PostgreSQL database.
 * All data flows through the haiCore API.
 */

// Mirrors PROTOCOL_VERSION from @haiwave/protocol. Inlined because Turbopack on
// Windows can't resolve value imports through `file:` symlinks. Keep in sync
// with packages/protocol/src/version.ts.
const PROTOCOL_VERSION = '3.0.0';
import type {
  ProvenanceKey,
  ProvenanceKeyWithCounts,
  ProvenanceKeyCreationRequest,
  ProvenanceKeyCreationResponse,
  ProvenanceKeyInstallation,
  ProvenanceKeyPatch,
  InstallationCreationRequest,
  InstallationPatch,
  InstallationPreview,
  SharingPolicy,
  SharingPolicyUpdateRequest,
  SharingPolicyUpdateResponse,
  AuditScope,
  AuditScopeCreationRequest,
  AuditScopeCoverage,
  AuditRun,
  AuditRunResult,
  ClassRollupEntry,
  RunTriggerRequest,
  RefreshVendorRequest,
  RunStatusResponse,
  CancelRunResponse,
  SkuObligation,
  SkuObligationListQuery,
  DownstreamGapEntry,
  AggregateReport,
  PerVendorReport,
  TrustBypassConfig,
  TrustClass,
  TrustBypassActivationRequest,
  TrustBypassDeactivationRequest,
  TrustBypassAffectedCounterparty,
  Type2Run,
  Type2Result,
  Type2RunStatus,
  Type2RunTriggerRequest,
  Type2SignalSubscription,
  Type2SignalSubscriptionPatch,
} from '@haiwave/protocol';

import type {
  InboundNominationGroup,
  ResponderQueueFilters,
} from '@/app/account/monitoring/audit-nominations/_lib/types';

import type {
  DownstreamGapFilters,
} from '@/app/account/sonar/audit/downstream-gaps/_lib/types';

// Catalog types — not exported from @haiwave/protocol (CatalogService lives in
// haiCore only). Defined locally to match the haiCore route response shapes.
export interface CatalogClass {
  class_id: string;
  class_slug: string;
  class_name: string;
  product_count: number;
}

export interface CatalogProduct {
  external_product_id: string;
  product_name: string | null;
  primary_class_slug: string | null;
}

// Mirrors AuditEvent / AuditEventResponse from @haiwave/protocol. Inlined because
// Turbopack on Windows can't resolve value-or-type imports through `file:` symlinks
// reliably in the BFF route. Keep in sync with packages/protocol/src/audit/index.ts.
type AuditEventMirror = {
  id: string;
  event_type: string;
  actor_id: string;
  actor_type: string;
  participant_id?: string | null;
  target_entity_type?: string | null;
  target_entity_id?: string | null;
  action: string;
  details?: Record<string, unknown> | null;
  ip_address?: string | null;
  retention_class: 'critical' | 'standard' | 'ephemeral';
  timestamp: string;
};
type AuditEventResponseMirror = {
  events: AuditEventMirror[];
  total: number;
  page: number;
  page_size: number;
};

const API_URL = process.env.HAIWAVE_API_URL ?? "http://localhost:3000";

export const haiwaveApiUrl = `${API_URL}/api/v1`;

// ─── Public (unauthenticated) Registration API ──────────────

export async function registerParticipant(data: {
  legal_name: string;
  dba_name?: string;
  business_type: string;
  tax_id_ein?: string;
  duns_number?: string;
  primary_contact_email: string;
  primary_contact_phone: string;
  primary_contact_name: string;
  business_address_city: string;
  business_address_state: string;
  business_address_country: string;
  website_url?: string;
  vendor_description?: string;
}): Promise<{ participant_id: string; status: string }> {
  const res = await fetch(`${haiwaveApiUrl}/registration/participant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-HaiWave-Protocol-Version": PROTOCOL_VERSION,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Participant registration failed: ${res.status} ${text}`);
  }

  return res.json();
}

// ─── Types & Client Factory ─────────────────────────────────────────

// Core basic types to improve type safety instead of returning unknown
export interface ParticipantProfile {
  id: string;
  company_name: string;
  [key: string]: unknown;
}

export interface ConnectionRecord {
  id: string;
  target_participant_id: string;
  status: string;
  [key: string]: unknown;
}

export interface ScoreData {
  composite: number;
  components: Array<{ label: string; value: number }>;
}

export const CLASSIFICATION_OVERRIDE_ACTIONS = [
  'reassign',
  'new_node_request',
  'non_product',
  'dismiss',
] as const;
export type ClassificationOverrideAction = typeof CLASSIFICATION_OVERRIDE_ACTIONS[number];

export interface ClassificationResult {
  product_id: string;
  status: 'classified' | 'unclassifiable' | 'dismissed' | 'non_product' | 'source_deleted';
  assigned_node_ids: string[];
  primary_node_id: string | null;
  classifier_confidence: number;
  match_confidence: number;
  unclassifiable_reason: string | null;
  classifier_model: string;
  classified_at: string;
  assignment_source: string;
}

export interface ConceptNodeSummary {
  node_id: string;
  slug: string;
  master_label: string;
  description: string;
  status: string;
  taxonomy_version: number;
  created_at: string;
}

export interface ClassificationOverrideInput {
  product_id: string;
  action: ClassificationOverrideAction;
  to_node_ids?: string[];
  proposed_label?: string;
  proposed_desc?: string;
  reason?: string;
}

/**
 * Activation response shape returned by POST /sonar/audit/trust-bypass/activate.
 * Mirrors the haiCore route handler — the server emits a stripped config
 * (config_id, trust_class, enabled, enabled_at) plus an optional dissolution
 * payload populated only on retroactive activation. The full TrustBypassConfig
 * schema is overkill here; the dissolution arrays drive the post-activation
 * toast (preserved decline count) and the modal-close handler.
 */
export interface TrustBypassActivationResponse {
  config: {
    config_id: string;
    trust_class: TrustClass;
    enabled: boolean;
    enabled_at: string | null;
  };
  dissolution: {
    affected_counterparty_ids: string[];
    affected_obligation_ids: string[];
    preserved_decline_ids: string[];
  } | null;
}

export interface HaiwaveClient {
  searchParticipants(query: string, options?: { limit?: number }): Promise<ParticipantProfile[]>;
  getCompanyProfile(id: string): Promise<ParticipantProfile>;
  requestConnection(targetId: string, opts?: { message?: string }): Promise<ConnectionRecord>;
  listPendingRequests(): Promise<ConnectionRecord[]>;
  listActiveConnections(): Promise<ConnectionRecord[]>;
  approveRequest(requestId: string): Promise<ConnectionRecord>;
  denyRequest(requestId: string): Promise<ConnectionRecord>;
  updateInvite(connectionId: string, invite: boolean): Promise<ConnectionRecord>;
  getScore(participantId: string): Promise<ScoreData>;
  getScoreHistory(participantId: string): Promise<Record<string, number[]>>;
  getCounterpartyManifest(id: string): Promise<Record<string, unknown>>;
  updateCounterpartyManifest(data: unknown): Promise<Record<string, unknown>>;
  updatePricingManifest(data: unknown): Promise<Record<string, unknown>>;
  getAgentStatus(agentId: string): Promise<Record<string, unknown>>;
  // Admin
  getAdminOverview(): Promise<Record<string, unknown>>;
  getConnectionAnalytics(): Promise<Record<string, unknown>>;
  getAbuseMonitoring(): Promise<Record<string, unknown>>;
  getNetworkHealth(): Promise<Record<string, unknown>>;
  queryAuditEvents(params: Record<string, string>): Promise<Record<string, unknown>[]>;
  adminSuspend(participantId: string, justification: string): Promise<{ success: boolean }>;
  adminReactivate(participantId: string, justification: string): Promise<{ success: boolean }>;
  adminClearBan(participantId: string, blockedId: string, justification: string): Promise<{ success: boolean }>;
  adminOverrideTier(participantId: string, newTier: string, justification: string): Promise<{ success: boolean }>;
  adminOverrideScore(participantId: string, newScore: number, justification: string): Promise<{ success: boolean }>;
  // Pricing Hierarchy
  getPricingHierarchy(participantId: string): Promise<Record<string, unknown>[]>;
  upsertPricingLevel(data: unknown): Promise<{ success: boolean }>;
  deletePricingLevel(manifestId: string): Promise<{ success: boolean }>;
  bulkUploadPricing(entries: unknown[]): Promise<{ success: boolean }>;
  // Approval Rules
  getApprovalRules(): Promise<Record<string, unknown>>;
  updateBulkCriteria(data: unknown): Promise<{ success: boolean }>;
  updatePerRequestRules(data: unknown): Promise<{ success: boolean }>;
  testApprovalRules(hypothetical: unknown): Promise<Record<string, unknown>>;
  // Blocked / Downgrade
  listBlocked(): Promise<Record<string, unknown>[]>;
  blockParticipant(targetId: string): Promise<{ success: boolean }>;
  unblockParticipant(blockedId: string): Promise<{ success: boolean }>;
  downgradeConnection(connectionId: string): Promise<ConnectionRecord>;
  // Payments (v1.11)
  getWallet(participantId: string): Promise<Record<string, unknown>>;
  getWalletBalance(walletId: string): Promise<{ balance: number; currency: string }>;
  registerWallet(data: unknown): Promise<{ wallet_id: string }>;
  getPaymentManifest(participantId: string, type?: string): Promise<Record<string, unknown>>;
  updatePaymentManifest(data: unknown): Promise<{ success: boolean }>;
  getSpendingPolicy(participantId: string): Promise<Record<string, unknown>>;
  updateSpendingPolicy(data: unknown): Promise<{ success: boolean }>;
  getPaymentHistory(address: string, limit?: number, offset?: number): Promise<Record<string, unknown>[]>;
  getPaymentStatus(orderId: string): Promise<{ status: string }>;
  approvePayment(orderId: string, approverEmail: string): Promise<{ success: boolean }>;
  rejectPayment(orderId: string, reason: string): Promise<{ success: boolean }>;
  // Orders (v1.15)
  getSellSideOrders(statusFilter?: string): Promise<Record<string, unknown>[]>;
  acceptInvoice(orderId: string, invoiceId: string): Promise<Record<string, unknown>>;
  processOrder(sellSideOrderId: string): Promise<{ status: string; erp_order_reference?: string }>;
  completeOrder(sellSideOrderId: string): Promise<{ status: string }>;
  // Provenance (v1.15)
  getOriginManifests(): Promise<Record<string, unknown>>;
  getOriginManifest(productId: string): Promise<Record<string, unknown>>;
  getCertifications(filters?: Record<string, string>): Promise<Record<string, unknown>>;
  getProvenanceChain(chainId: string): Promise<Record<string, unknown>>;
  // Compliance (v1.15)
  getComplianceReport(filters?: Record<string, string>): Promise<Record<string, unknown>>;
  triggerSelfAudit(): Promise<Record<string, unknown>>;
  // Phantom Demand (v1.15)
  getPhantomDemandUsage(billingMonth?: string): Promise<Record<string, unknown>>;
  getPhantomDemandForecast(): Promise<Record<string, unknown>>;
  // Classification Review Queue (v1.20)
  listClassificationResults(participantId: string, options?: { status?: string; limit?: number; offset?: number }): Promise<{ results: ClassificationResult[]; total: number }>;
  submitClassificationOverride(input: ClassificationOverrideInput): Promise<{ success: boolean }>;
  listConceptNodes(): Promise<{ nodes: ConceptNodeSummary[]; total_count: number }>;
  // Provenance Keys (v1.21)
  listGeneratedKeys(): Promise<ProvenanceKeyWithCounts[]>;
  generateKey(body: ProvenanceKeyCreationRequest): Promise<ProvenanceKeyCreationResponse>;
  updateKey(keyId: string, patch: ProvenanceKeyPatch): Promise<ProvenanceKey>;
  revokeKey(keyId: string): Promise<ProvenanceKey>;
  revealKeyValue(keyId: string): Promise<{ key_value: string }>;
  listInstallationsForKey(keyId: string): Promise<{ installations: ProvenanceKeyInstallation[] }>;
  listKeyAudit(
    keyId: string,
    params?: { page?: number; page_size?: number; event_type?: string },
  ): Promise<AuditEventResponseMirror>;
  previewInstallation(body: { key_hash: string }): Promise<InstallationPreview>;
  installKey(body: InstallationCreationRequest): Promise<ProvenanceKeyInstallation>;
  listMyInstallations(includeRemoved?: boolean): Promise<ProvenanceKeyInstallation[]>;
  updateInstallation(installationId: string, patch: InstallationPatch): Promise<ProvenanceKeyInstallation>;
  removeInstallation(installationId: string): Promise<ProvenanceKeyInstallation>;
  getSharingPolicy(): Promise<SharingPolicy>;
  upsertSharingPolicy(body: SharingPolicyUpdateRequest): Promise<SharingPolicyUpdateResponse>;
  // Catalog (v1.25)
  listCatalogClasses(vendorId: string): Promise<{ classes: CatalogClass[] }>;
  listCatalogProducts(
    vendorId: string,
    opts?: { classId?: string; page?: number; size?: number },
  ): Promise<{ products: CatalogProduct[]; total: number }>;
  // Audit Scopes (v1.25)
  createAuditScope(body: AuditScopeCreationRequest): Promise<AuditScope>;
  listAuditScopes(opts?: {
    vendorId?: string;
    scopeType?: string;
    activeOnly?: boolean;
  }): Promise<{ scopes: AuditScope[] }>;
  deleteAuditScope(scopeId: string): Promise<void>;
  getAuditCoverage(vendorId: string): Promise<AuditScopeCoverage>;
  // Audit Runs (v1.25)
  triggerAuditRun(body?: RunTriggerRequest): Promise<{ run_id: string; status: string }>;
  refreshVendorAudit(body: RefreshVendorRequest): Promise<{ run_id: string; status: string }>;
  listAuditRuns(opts?: { status?: string; limit?: number }): Promise<{ runs: AuditRun[] }>;
  getAuditRun(runId: string): Promise<AuditRun>;
  getAuditRunResults(
    runId: string,
    opts?: { vendorId?: string; productId?: string },
  ): Promise<{ results: AuditRunResult[] }>;
  getAuditRunClassRollup(runId: string): Promise<{ rollup: ClassRollupEntry[] }>;
  // Audit Runs (v1.27 Phase 2)
  getAuditRunStatus(runId: string): Promise<RunStatusResponse>;
  cancelAuditRun(runId: string): Promise<CancelRunResponse>;
  // ─── SKU obligations (v1.27 Phase 4 routes; consumed by Phase 7) ─────
  listObligations(query: SkuObligationListQuery): Promise<SkuObligation[]>;
  getResponderQueue(filters?: ResponderQueueFilters): Promise<InboundNominationGroup[]>;
  getDownstreamGaps(filters?: DownstreamGapFilters): Promise<DownstreamGapEntry[]>;
  getObligation(id: string): Promise<SkuObligation>;
  acknowledgeObligation(id: string): Promise<SkuObligation>;
  declineObligation(id: string, notes?: string): Promise<SkuObligation>;
  deferObligation(id: string, notes?: string): Promise<SkuObligation>;
  // ─── Audit reports (v1.27 Phase 8) ───────────────────────────────────
  getAggregateReport(runId: string): Promise<AggregateReport>;
  getPerVendorReport(runId: string, vendorId: string): Promise<PerVendorReport>;
  // ─── Trust bypass (v1.28 Phase 2) ────────────────────────────────────
  listTrustBypassConfigs(): Promise<{ configs: TrustBypassConfig[] }>;
  getTrustBypassAffectedCounterparties(
    trustClass: TrustClass,
  ): Promise<{ counterparties: TrustBypassAffectedCounterparty[] }>;
  activateTrustBypass(body: TrustBypassActivationRequest): Promise<TrustBypassActivationResponse>;
  deactivateTrustBypass(body: TrustBypassDeactivationRequest): Promise<void>;
  // ─── Type 2 (v1.28 Phase 5) ──────────────────────────────────────────
  triggerType2Run(body: Type2RunTriggerRequest): Promise<{ run_id: string; status: Type2RunStatus }>;
  listType2Runs(): Promise<{ runs: Type2Run[] }>;
  getType2Run(runId: string): Promise<{ run: Type2Run; results: Type2Result[] }>;
  getType2RunStatus(runId: string): Promise<{ status: Type2RunStatus }>;
  cancelType2Run(runId: string): Promise<{ cancelled: boolean }>;
  listType2Subscriptions(): Promise<{ subscriptions: Type2SignalSubscription[] }>;
  patchType2Subscription(
    id: string,
    patch: Type2SignalSubscriptionPatch,
  ): Promise<{ subscription: Type2SignalSubscription }>;
  /** Direct passthrough to haiCore. Used for non-JSON content negotiation
   * (CSV reports). Returns the raw Response so callers can inspect status,
   * forward content-type, and stream the body verbatim. */
  fetchRaw(path: string, init?: RequestInit): Promise<Response>;
}

export function createHaiwaveClient(token: string, participantId: string): HaiwaveClient {
  const baseHeaders: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "x-haiwave-participant-id": participantId,
    "X-HaiWave-Protocol-Version": PROTOCOL_VERSION,
  };

  async function request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { ...baseHeaders };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(`${haiwaveApiUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      // Surface status + parsed error body on the thrown error so the BFF
      // wrapper can propagate 4xx codes (e.g. 403 NO_VENDOR_ACCESS) to the
      // client verbatim instead of masking everything as 500.
      const err = new Error(`haiCore ${method} ${path}: ${res.status} ${text}`) as Error & {
        status?: number;
        haiCoreBody?: unknown;
      };
      err.status = res.status;
      try { err.haiCoreBody = JSON.parse(text); } catch { /* non-JSON body */ }
      throw err;
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return res.json() as Promise<T>;
    }
    return null as unknown as T;
  }

  return {
    searchParticipants(query, options) {
      const params = new URLSearchParams({ q: query });
      if (options?.limit) params.set("limit", String(options.limit));
      return request<ParticipantProfile[]>("GET", `/participants/search?${params}`);
    },

    getCompanyProfile(id) {
      return request<ParticipantProfile>("GET", `/company/${id}/profile`);
    },

    requestConnection(targetId, opts) {
      return request<ConnectionRecord>("POST", "/connections/request", {
        target_participant_id: targetId,
        message: opts?.message,
      });
    },

    async listPendingRequests() {
      // haiCore envelopes as { requests: [...] }; unwrap so callers get a plain array.
      const envelope = await request<{ requests?: ConnectionRecord[] }>(
        "GET",
        "/connections/pending",
      );
      return envelope.requests ?? [];
    },

    async listActiveConnections() {
      // haiCore envelopes as { connections: [...] }; unwrap so callers get a plain array.
      const envelope = await request<{ connections?: ConnectionRecord[] }>(
        "GET",
        "/connections/active",
      );
      return envelope.connections ?? [];
    },

    approveRequest(requestId) {
      return request<ConnectionRecord>("POST", `/connections/${requestId}/approve`);
    },

    denyRequest(requestId) {
      return request<ConnectionRecord>("POST", `/connections/${requestId}/deny`);
    },

    updateInvite(connectionId, invite) {
      return request<ConnectionRecord>("PATCH", `/connections/${connectionId}/invite`, { invite });
    },

    getScore(participantId) {
      return request<ScoreData>("GET", `/behavioral/score/${participantId}`);
    },

    getScoreHistory(participantId) {
      return request<Record<string, number[]>>("GET", `/behavioral/history/${participantId}`);
    },

    getCounterpartyManifest(id) {
      return request<Record<string, unknown>>("GET", `/manifest/counterparty/${id}`);
    },

    updateCounterpartyManifest(data) {
      return request<Record<string, unknown>>("PUT", "/manifest/counterparty", data);
    },

    updatePricingManifest(data) {
      return request<Record<string, unknown>>("PUT", "/manifest/pricing", data);
    },

    getAgentStatus(agentId) {
      return request<Record<string, unknown>>("GET", `/heartbeat/status/${agentId}`);
    },

    // ─── Admin ───────────────────────────────────────────
    getAdminOverview() {
      return request<Record<string, unknown>>("GET", "/admin/dashboard/overview");
    },
    getConnectionAnalytics() {
      return request<Record<string, unknown>>("GET", "/admin/dashboard/connections");
    },
    getAbuseMonitoring() {
      return request<Record<string, unknown>>("GET", "/admin/dashboard/abuse");
    },
    getNetworkHealth() {
      return request<Record<string, unknown>>("GET", "/admin/dashboard/health");
    },
    queryAuditEvents(params: Record<string, string>) {
      const qs = new URLSearchParams(params);
      return request<Record<string, unknown>[]>("GET", `/admin/audit?${qs}`);
    },
    adminSuspend(participantId: string, justification: string) {
      return request<{ success: boolean }>("POST", "/admin/actions/suspend", { participant_id: participantId, justification });
    },
    adminReactivate(participantId: string, justification: string) {
      return request<{ success: boolean }>("POST", "/admin/actions/reactivate", { participant_id: participantId, justification });
    },
    adminClearBan(participantId: string, blockedId: string, justification: string) {
      return request<{ success: boolean }>("POST", "/admin/actions/clear-ban", { participant_id: participantId, blocked_participant_id: blockedId, justification });
    },
    adminOverrideTier(participantId: string, newTier: string, justification: string) {
      return request<{ success: boolean }>("POST", "/admin/actions/override-tier", { participant_id: participantId, new_tier: newTier, justification });
    },
    adminOverrideScore(participantId: string, newScore: number, justification: string) {
      return request<{ success: boolean }>("POST", "/admin/actions/override-score", { participant_id: participantId, new_score: newScore, justification });
    },

    // ─── Pricing Hierarchy ───────────────────────────────
    getPricingHierarchy(participantId: string) {
      return request<Record<string, unknown>[]>("GET", `/pricing/hierarchy/${participantId}`);
    },
    upsertPricingLevel(data: unknown) {
      return request<{ success: boolean }>("PUT", "/pricing/level", data);
    },
    deletePricingLevel(manifestId: string) {
      return request<{ success: boolean }>("DELETE", `/pricing/level/${manifestId}`);
    },
    bulkUploadPricing(entries: unknown[]) {
      return request<{ success: boolean }>("POST", "/pricing/bulk-upload", { entries });
    },

    // ─── Approval Rules ─────────────────────────────────
    getApprovalRules() {
      return request<Record<string, unknown>>("GET", "/approval-rules");
    },
    updateBulkCriteria(data: unknown) {
      return request<{ success: boolean }>("PUT", "/approval-rules/bulk-criteria", data);
    },
    updatePerRequestRules(data: unknown) {
      return request<{ success: boolean }>("PUT", "/approval-rules/per-request", data);
    },
    testApprovalRules(hypothetical: unknown) {
      return request<Record<string, unknown>>("POST", "/approval-rules/test", hypothetical);
    },

    // ─── Blocked / Downgrade ────────────────────────────
    listBlocked() {
      return request<Record<string, unknown>[]>("GET", "/connections/blocked");
    },
    blockParticipant(targetId: string) {
      return request<{ success: boolean }>("POST", "/connections/block", { target_participant_id: targetId });
    },
    unblockParticipant(blockedId: string) {
      return request<{ success: boolean }>("DELETE", `/connections/block?blocked_participant_id=${blockedId}`);
    },
    downgradeConnection(connectionId: string) {
      return request<ConnectionRecord>("POST", `/connections/${connectionId}/downgrade`);
    },

    // ─── Payments (v1.11) ────────────────────────────────
    getWallet(participantId: string) {
      return request<Record<string, unknown>>("GET", `/wallets/${participantId}`);
    },
    getWalletBalance(walletId: string) {
      return request<{ balance: number; currency: string }>("GET", `/wallets/${walletId}/balance`);
    },
    registerWallet(data: unknown) {
      return request<{ wallet_id: string }>("POST", "/wallets/register", data);
    },
    getPaymentManifest(participantId: string, type = "vendor") {
      return request<Record<string, unknown>>("GET", `/payments/manifests/${participantId}?type=${type}`);
    },
    updatePaymentManifest(data: unknown) {
      return request<{ success: boolean }>("POST", "/payments/manifests", data);
    },
    getSpendingPolicy(participantId: string) {
      return request<Record<string, unknown>>("GET", `/policies/spending/${participantId}`);
    },
    updateSpendingPolicy(data: unknown) {
      return request<{ success: boolean }>("POST", "/policies/spending", data);
    },
    getPaymentHistory(address: string, limit = 20, offset = 0) {
      return request<Record<string, unknown>[]>("GET", `/payments/history?address=${address}&limit=${limit}&offset=${offset}`);
    },
    getPaymentStatus(orderId: string) {
      return request<{ status: string }>("GET", `/payments/${orderId}/status`);
    },
    approvePayment(orderId: string, approverEmail: string) {
      return request<{ success: boolean }>("POST", `/payments/${orderId}/approve`, { approver_email: approverEmail });
    },
    rejectPayment(orderId: string, reason: string) {
      return request<{ success: boolean }>("POST", `/payments/${orderId}/reject`, { reason });
    },

    // ─── Orders (v1.15) ───────────────────────────────────
    getSellSideOrders(statusFilter?: string) {
      const qs = statusFilter ? `?status=${statusFilter}` : "";
      return request<Record<string, unknown>[]>("GET", `/orders/sell-side${qs}`);
    },
    acceptInvoice(orderId: string, invoiceId: string) {
      return request<Record<string, unknown>>("POST", `/orders/${orderId}/invoice/accept`, { invoice_id: invoiceId });
    },
    processOrder(sellSideOrderId: string) {
      return request<{ status: string; erp_order_reference?: string }>("POST", `/orders/sell-side/${sellSideOrderId}/process`);
    },
    completeOrder(sellSideOrderId: string) {
      return request<{ status: string }>("POST", `/orders/sell-side/${sellSideOrderId}/complete`);
    },

    // ─── Provenance (v1.15) ──────────────────────────────
    getOriginManifests() {
      return request<Record<string, unknown>>("GET", "/provenance/manifest");
    },
    getOriginManifest(productId: string) {
      return request<Record<string, unknown>>("GET", `/provenance/manifest?product_id=${productId}`);
    },
    getCertifications(filters?: Record<string, string>) {
      const qs = filters ? `?${new URLSearchParams(filters)}` : "";
      return request<Record<string, unknown>>("GET", `/provenance/certifications${qs}`);
    },
    getProvenanceChain(chainId: string) {
      return request<Record<string, unknown>>("GET", `/provenance/chain/${chainId}`);
    },

    // ─── Compliance (v1.15) ──────────────────────────────
    getComplianceReport(filters?: Record<string, string>) {
      const qs = filters ? `?${new URLSearchParams(filters)}` : "";
      return request<Record<string, unknown>>("GET", `/noncompliance/report${qs}`);
    },
    triggerSelfAudit() {
      return request<Record<string, unknown>>("POST", "/noncompliance/self-audit");
    },

    // ─── Phantom Demand (v1.15) ──────────────────────────
    getPhantomDemandUsage(billingMonth?: string) {
      const qs = billingMonth ? `?billing_month=${billingMonth}` : "";
      return request<Record<string, unknown>>("GET", `/phantom-demand/usage${qs}`);
    },
    getPhantomDemandForecast() {
      return request<Record<string, unknown>>("GET", "/phantom-demand/forecast");
    },

    // ─── Classification Review Queue (v1.20) ────────────────
    async listClassificationResults(participantId, options) {
      const params = new URLSearchParams();
      if (options?.status) params.set('status', options.status);
      if (options?.limit !== undefined) params.set('limit', String(options.limit));
      if (options?.offset !== undefined) params.set('offset', String(options.offset));
      const query = params.toString() ? `?${params.toString()}` : '';
      return request<{ results: ClassificationResult[]; total: number }>('GET', `/classify/results/${participantId}${query}`);
    },
    async submitClassificationOverride(input) {
      return request<{ success: boolean }>('POST', '/classify/override', input);
    },
    async listConceptNodes() {
      return request<{ nodes: ConceptNodeSummary[]; total_count: number }>('GET', '/taxonomy/classes');
    },

    // ─── Provenance Keys (v1.21) ──────────────────────────────
    listGeneratedKeys() {
      return request<ProvenanceKeyWithCounts[]>('GET', '/provenance-keys/generated');
    },
    generateKey(body) {
      return request<ProvenanceKeyCreationResponse>('POST', '/provenance-keys/', body);
    },
    updateKey(keyId, patch) {
      return request<ProvenanceKey>('PATCH', `/provenance-keys/${keyId}`, patch);
    },
    revokeKey(keyId) {
      return request<ProvenanceKey>('DELETE', `/provenance-keys/${keyId}`);
    },
    revealKeyValue(keyId) {
      return request<{ key_value: string }>('GET', `/provenance-keys/${keyId}/value`);
    },
    listInstallationsForKey(keyId) {
      return request<{ installations: ProvenanceKeyInstallation[] }>('GET', `/provenance-keys/${keyId}/installations`);
    },
    listKeyAudit(keyId, params) {
      const qs = new URLSearchParams();
      if (params?.page !== undefined) qs.set('page', String(params.page));
      if (params?.page_size !== undefined) qs.set('page_size', String(params.page_size));
      if (params?.event_type) qs.set('event_type', params.event_type);
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      return request<AuditEventResponseMirror>('GET', `/provenance-keys/${keyId}/audit${suffix}`);
    },
    previewInstallation(body) {
      return request<InstallationPreview>('POST', '/provenance-keys/installations/preview', body);
    },
    installKey(body) {
      return request<ProvenanceKeyInstallation>('POST', '/provenance-keys/installations', body);
    },
    listMyInstallations(includeRemoved = false) {
      const suffix = includeRemoved ? '?include_removed=true' : '';
      return request<ProvenanceKeyInstallation[]>('GET', `/provenance-keys/installations${suffix}`);
    },
    updateInstallation(installationId, patch) {
      return request<ProvenanceKeyInstallation>('PATCH', `/provenance-keys/installations/${installationId}`, patch);
    },
    removeInstallation(installationId) {
      return request<ProvenanceKeyInstallation>('DELETE', `/provenance-keys/installations/${installationId}`);
    },
    getSharingPolicy() {
      return request<SharingPolicy>('GET', '/sharing-policy/');
    },
    upsertSharingPolicy(body) {
      return request<SharingPolicyUpdateResponse>('PUT', '/sharing-policy/', body);
    },

    // ─── Catalog (v1.25) ─────────────────────────────────────
    listCatalogClasses(vendorId) {
      return request<{ classes: CatalogClass[] }>(
        'GET',
        `/participants/${vendorId}/catalog-classes`,
      );
    },
    listCatalogProducts(vendorId, opts = {}) {
      const params = new URLSearchParams();
      if (opts.classId) params.set('class_id', opts.classId);
      if (opts.page !== undefined) params.set('page', String(opts.page));
      if (opts.size !== undefined) params.set('size', String(opts.size));
      const q = params.toString();
      return request<{ products: CatalogProduct[]; total: number }>(
        'GET',
        `/participants/${vendorId}/catalog-products${q ? `?${q}` : ''}`,
      );
    },

    // ─── Audit Scopes (v1.25) ────────────────────────────────
    createAuditScope(body) {
      return request<AuditScope>('POST', '/audit-scopes', body);
    },
    listAuditScopes(opts = {}) {
      const params = new URLSearchParams();
      if (opts.vendorId) params.set('vendor_id', opts.vendorId);
      if (opts.scopeType) params.set('scope_type', opts.scopeType);
      if (opts.activeOnly === false) params.set('active_only', 'false');
      const q = params.toString();
      return request<{ scopes: AuditScope[] }>(
        'GET',
        `/audit-scopes${q ? `?${q}` : ''}`,
      );
    },
    async deleteAuditScope(scopeId) {
      await request<void>('DELETE', `/audit-scopes/${scopeId}`);
    },
    getAuditCoverage(vendorId) {
      return request<AuditScopeCoverage>(
        'GET',
        `/audit-coverage?vendor_id=${encodeURIComponent(vendorId)}`,
      );
    },

    // ─── Audit Runs (v1.25) ──────────────────────────────────
    triggerAuditRun(body: RunTriggerRequest = { scope_type: 'company' }) {
      return request<{ run_id: string; status: string }>(
        'POST',
        '/source-audit/runs',
        body,
      );
    },
    refreshVendorAudit(body) {
      return request<{ run_id: string; status: string }>(
        'POST',
        '/source-audit/runs/refresh-vendor',
        body,
      );
    },
    listAuditRuns(opts = {}) {
      const params = new URLSearchParams();
      if (opts.status) params.set('status', opts.status);
      if (opts.limit !== undefined) params.set('limit', String(opts.limit));
      const q = params.toString();
      return request<{ runs: AuditRun[] }>(
        'GET',
        `/source-audit/runs${q ? `?${q}` : ''}`,
      );
    },
    getAuditRun(runId) {
      return request<AuditRun>('GET', `/source-audit/runs/${runId}`);
    },
    getAuditRunResults(runId, opts = {}) {
      const params = new URLSearchParams();
      if (opts.vendorId) params.set('vendor_id', opts.vendorId);
      if (opts.productId) params.set('product_id', opts.productId);
      const q = params.toString();
      return request<{ results: AuditRunResult[] }>(
        'GET',
        `/source-audit/runs/${runId}/results${q ? `?${q}` : ''}`,
      );
    },
    getAuditRunClassRollup(runId) {
      return request<{ rollup: ClassRollupEntry[] }>(
        'GET',
        `/source-audit/runs/${runId}/class-rollup`,
      );
    },
    getAuditRunStatus(runId) {
      return request<RunStatusResponse>('GET', `/source-audit/runs/${runId}/status`);
    },
    cancelAuditRun(runId) {
      return request<CancelRunResponse>('POST', `/source-audit/runs/${runId}/cancel`);
    },

    // ─── SKU obligations ────────────────────────────────────────
    async listObligations(query) {
      const params = new URLSearchParams();
      if (query.observer_participant_id) params.set('observer_participant_id', query.observer_participant_id);
      if (query.responder_participant_id) params.set('responder_participant_id', query.responder_participant_id);
      if (query.product_id) params.set('product_id', query.product_id);
      if (query.status) params.set('status', query.status);
      if (query.limit !== undefined) params.set('limit', String(query.limit));
      const envelope = await request<{ obligations: SkuObligation[] }>(
        'GET',
        `/sku-obligations?${params}`,
      );
      return envelope.obligations;
    },

    async getResponderQueue(filters) {
      // Composed: flat list + connections join + grouping. Called by the
      // BFF /api/account/sku-obligations/responder-queue route.
      const obligations = await this.listObligations({
        responder_participant_id: participantId,
        // All status filtering happens client-side because haiCore's
        // SkuObligationListQuery.status accepts only a single string —
        // passing the first of N selected statuses would silently drop the rest.
        // TODO: widen SkuObligationListQuery.status to string[] in v1.28+
        // and remove the client-side filter.
      });
      const connections = (await this.listActiveConnections()) as unknown as Array<{
        partner_participant_id: string;
        partner_name: string;
      }>;
      const partnerName = new Map<string, string>();
      for (const c of connections) partnerName.set(c.partner_participant_id, c.partner_name);

      const filtered = obligations.filter((o) => {
        if (filters?.status && !filters.status.includes(o.status)) return false;
        if (filters?.observer_id && !filters.observer_id.includes(o.observer_participant_id)) return false;
        return true;
      });

      const rows = filtered.map((o) => ({
        obligation_id: o.obligation_id,
        observer_participant_id: o.observer_participant_id,
        observer_display_name:
          partnerName.get(o.observer_participant_id) ??
          `Unknown (${o.observer_participant_id.slice(0, 8)})`,
        product_id: o.product_id,
        sku_label: o.sku_label,
        status: o.status,
        arrival_time: o.created_at,
        resolution_class: o.resolution_class,
        unresolved_subtier_count: o.unresolved_subtier_count,
      }));

      const { groupNominations } = await import(
        '@/app/account/monitoring/audit-nominations/_lib/group-nominations'
      );
      return groupNominations(rows);
    },

    async getDownstreamGaps(filters) {
      const envelope = await request<{ entries: DownstreamGapEntry[] }>(
        'GET',
        '/sku-obligations/downstream-gaps',
      );
      const entries = envelope.entries;
      // haiCore's downstream-gaps endpoint doesn't accept filter query params,
      // so we filter client-side in the BFF after fetch. The result set is small.
      return entries.filter((e) => {
        if (filters?.resolution_class && !filters.resolution_class.includes(e.resolution_class)) return false;
        if (filters?.on_network_status && !filters.on_network_status.includes(e.on_network_status)) return false;
        if (filters?.min_request_count !== undefined && e.request_count < filters.min_request_count) return false;
        return true;
      });
    },

    getObligation(id) {
      return request<SkuObligation>('GET', `/sku-obligations/${id}`);
    },

    acknowledgeObligation(id) {
      return request<SkuObligation>('POST', `/sku-obligations/${id}/acknowledge`, {});
    },

    declineObligation(id, notes) {
      return request<SkuObligation>('POST', `/sku-obligations/${id}/decline`, notes ? { notes } : {});
    },

    deferObligation(id, notes) {
      return request<SkuObligation>('POST', `/sku-obligations/${id}/defer`, notes ? { notes } : {});
    },

    // ─── Audit reports (v1.27 Phase 8) ───────────────────────────────────
    getAggregateReport(runId) {
      return request<AggregateReport>(
        'GET',
        `/sonar/audit/reports/${runId}/aggregate`,
      );
    },
    getPerVendorReport(runId, vendorId) {
      return request<PerVendorReport>(
        'GET',
        `/sonar/audit/reports/${runId}/company/${vendorId}`,
      );
    },

    // ─── Trust bypass (v1.28 Phase 2) ────────────────────────────────────
    listTrustBypassConfigs() {
      return request<{ configs: TrustBypassConfig[] }>(
        'GET',
        '/sonar/audit/trust-bypass/configs',
      );
    },
    getTrustBypassAffectedCounterparties(trustClass) {
      return request<{ counterparties: TrustBypassAffectedCounterparty[] }>(
        'GET',
        `/sonar/audit/trust-bypass/affected-counterparties?trust_class=${encodeURIComponent(trustClass)}`,
      );
    },
    activateTrustBypass(body) {
      return request<TrustBypassActivationResponse>(
        'POST',
        '/sonar/audit/trust-bypass/activate',
        body,
      );
    },
    deactivateTrustBypass(body) {
      // haiCore returns 204 No Content; request<T>() returns null for non-JSON.
      return request<void>('POST', '/sonar/audit/trust-bypass/deactivate', body);
    },

    // ─── Type 2 (v1.28 Phase 5) ─────────────────────────────────────────
    triggerType2Run(body) {
      return request<{ run_id: string; status: Type2RunStatus }>(
        'POST',
        '/sonar/type2/runs',
        body,
      );
    },
    listType2Runs() {
      return request<{ runs: Type2Run[] }>('GET', '/sonar/type2/runs');
    },
    getType2Run(runId) {
      return request<{ run: Type2Run; results: Type2Result[] }>(
        'GET',
        `/sonar/type2/runs/${runId}`,
      );
    },
    getType2RunStatus(runId) {
      return request<{ status: Type2RunStatus }>(
        'GET',
        `/sonar/type2/runs/${runId}/status`,
      );
    },
    cancelType2Run(runId) {
      return request<{ cancelled: boolean }>(
        'POST',
        `/sonar/type2/runs/${runId}/cancel`,
      );
    },
    listType2Subscriptions() {
      return request<{ subscriptions: Type2SignalSubscription[] }>(
        'GET',
        '/sonar/type2/subscriptions',
      );
    },
    patchType2Subscription(id, patch) {
      return request<{ subscription: Type2SignalSubscription }>(
        'PATCH',
        `/sonar/type2/subscriptions/${id}`,
        patch,
      );
    },

    // INVARIANT: returns the raw Response and does NOT throw on non-OK
    // status (unlike request<T>()). Callers — see sonar/audit/reports/*
    // route.ts — rely on this to manually decide JSON vs error fallthrough,
    // typically forwarding 4xx body verbatim and converting unexpected
    // network failures to 500.
    fetchRaw(path, init) {
      return fetch(`${haiwaveApiUrl}${path}`, {
        ...init,
        headers: { ...baseHeaders, ...(init?.headers ?? {}) },
      });
    },
  };
}

export type {
  SkuObligation,
  SkuObligationStatus,
  ResolutionClass,
  DownstreamGapEntry,
  AggregateReport,
  PerVendorReport,
  AggregateReportHeader,
  PerVendorReportHeader,
  PostureSummary,
  CoverageSummary,
  GeographicRollupRow,
  GapInventoryEntry,
  PerVendorSummaryRow,
  SkuTableRow,
  GapDetailEntry,
  ReportFooter,
  ResolutionStatus,
  ClassRollupEntry,
  TrustBypassConfig,
  TrustClass,
  TrustBypassActivationRequest,
  TrustBypassDeactivationRequest,
  TrustBypassAffectedCounterparty,
  TrustBypassActivationMode,
} from '@haiwave/protocol';
