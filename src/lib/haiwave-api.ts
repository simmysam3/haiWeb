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
      "X-HaiWave-Protocol-Version": "1.0.0",
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
}

export function createHaiwaveClient(token: string, participantId: string): HaiwaveClient {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "x-participant-id": participantId,
    "X-HaiWave-Protocol-Version": "1.0.0",
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
  };
}
