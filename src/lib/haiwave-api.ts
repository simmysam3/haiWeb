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
} from '@haiwave/protocol';

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
  // Source Audit (v1.16)
  runEntityAudit(vendorId: string, productId: string, locationParameter: boolean): Promise<Record<string, unknown>>;
  runRegulatoryAudit(guideKeyId: string, jurisdiction: string): Promise<Record<string, unknown>>;
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
}

export function createHaiwaveClient(token: string, participantId: string): HaiwaveClient {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "x-haiwave-participant-id": participantId,
    "X-HaiWave-Protocol-Version": PROTOCOL_VERSION,
    "Content-Type": "application/json",
  };

  async function request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${haiwaveApiUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`haiCore ${method} ${path}: ${res.status} ${text}`);
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

    listPendingRequests() {
      return request<ConnectionRecord[]>("GET", "/connections/pending");
    },

    listActiveConnections() {
      return request<ConnectionRecord[]>("GET", "/connections/active");
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

    // ─── Source Audit (v1.16) ─────────────────────────────
    runEntityAudit(vendorId: string, productId: string, locationParameter: boolean) {
      return request<Record<string, unknown>>("POST", "/source-audit/entity", {
        vendor_participant_id: vendorId,
        external_product_id: productId,
        location_parameter: locationParameter,
      });
    },
    runRegulatoryAudit(guideKeyId: string, jurisdiction: string) {
      return request<Record<string, unknown>>("POST", "/source-audit/regulatory", {
        guide_key_id: guideKeyId,
        jurisdiction,
      });
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
  };
}
