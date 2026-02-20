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

// ─── Client Factory ─────────────────────────────────────────

export interface HaiwaveClient {
  searchParticipants(query: string, options?: { limit?: number }): Promise<unknown>;
  getCompanyProfile(id: string): Promise<unknown>;
  requestConnection(targetId: string, opts?: { message?: string }): Promise<unknown>;
  listPendingRequests(): Promise<unknown>;
  approveRequest(requestId: string): Promise<unknown>;
  denyRequest(requestId: string): Promise<unknown>;
  updateInvite(connectionId: string, invite: boolean): Promise<unknown>;
  getScore(participantId: string): Promise<unknown>;
  getScoreHistory(participantId: string): Promise<unknown>;
  getCounterpartyManifest(id: string): Promise<unknown>;
  updateCounterpartyManifest(data: unknown): Promise<unknown>;
  updatePricingManifest(data: unknown): Promise<unknown>;
  getAgentStatus(agentId: string): Promise<unknown>;
  // Admin
  getAdminOverview(): Promise<unknown>;
  getConnectionAnalytics(): Promise<unknown>;
  getAbuseMonitoring(): Promise<unknown>;
  getNetworkHealth(): Promise<unknown>;
  queryAuditEvents(params: Record<string, string>): Promise<unknown>;
  adminSuspend(participantId: string, justification: string): Promise<unknown>;
  adminReactivate(participantId: string, justification: string): Promise<unknown>;
  adminClearBan(participantId: string, blockedId: string, justification: string): Promise<unknown>;
  adminOverrideTier(participantId: string, newTier: string, justification: string): Promise<unknown>;
  adminOverrideScore(participantId: string, newScore: number, justification: string): Promise<unknown>;
  // Pricing Hierarchy
  getPricingHierarchy(participantId: string): Promise<unknown>;
  upsertPricingLevel(data: unknown): Promise<unknown>;
  deletePricingLevel(manifestId: string): Promise<unknown>;
  bulkUploadPricing(entries: unknown[]): Promise<unknown>;
  // Approval Rules
  getApprovalRules(): Promise<unknown>;
  updateBulkCriteria(data: unknown): Promise<unknown>;
  updatePerRequestRules(data: unknown): Promise<unknown>;
  testApprovalRules(hypothetical: unknown): Promise<unknown>;
  // Blocked / Downgrade
  listBlocked(): Promise<unknown>;
  blockParticipant(targetId: string): Promise<unknown>;
  unblockParticipant(blockedId: string): Promise<unknown>;
  downgradeConnection(connectionId: string): Promise<unknown>;
}

export function createHaiwaveClient(token: string, participantId: string): HaiwaveClient {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "x-participant-id": participantId,
    "X-HaiWave-Protocol-Version": "1.0.0",
    "Content-Type": "application/json",
  };

  async function request(method: string, path: string, body?: unknown): Promise<unknown> {
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
      return res.json();
    }
    return null;
  }

  return {
    searchParticipants(query, options) {
      const params = new URLSearchParams({ q: query });
      if (options?.limit) params.set("limit", String(options.limit));
      return request("GET", `/participants/search?${params}`);
    },

    getCompanyProfile(id) {
      return request("GET", `/company/${id}/profile`);
    },

    requestConnection(targetId, opts) {
      return request("POST", "/connections/request", {
        target_participant_id: targetId,
        message: opts?.message,
      });
    },

    listPendingRequests() {
      return request("GET", "/connections/pending");
    },

    approveRequest(requestId) {
      return request("POST", `/connections/${requestId}/approve`);
    },

    denyRequest(requestId) {
      return request("POST", `/connections/${requestId}/deny`);
    },

    updateInvite(connectionId, invite) {
      return request("PATCH", `/connections/${connectionId}/invite`, { invite });
    },

    getScore(participantId) {
      return request("GET", `/behavioral/score/${participantId}`);
    },

    getScoreHistory(participantId) {
      return request("GET", `/behavioral/history/${participantId}`);
    },

    getCounterpartyManifest(id) {
      return request("GET", `/manifest/counterparty/${id}`);
    },

    updateCounterpartyManifest(data) {
      return request("PUT", "/manifest/counterparty", data);
    },

    updatePricingManifest(data) {
      return request("PUT", "/manifest/pricing", data);
    },

    getAgentStatus(agentId) {
      return request("GET", `/heartbeat/status/${agentId}`);
    },

    // ─── Admin ───────────────────────────────────────────
    getAdminOverview() {
      return request("GET", "/admin/dashboard/overview");
    },
    getConnectionAnalytics() {
      return request("GET", "/admin/dashboard/connections");
    },
    getAbuseMonitoring() {
      return request("GET", "/admin/dashboard/abuse");
    },
    getNetworkHealth() {
      return request("GET", "/admin/dashboard/health");
    },
    queryAuditEvents(params: Record<string, string>) {
      const qs = new URLSearchParams(params);
      return request("GET", `/admin/audit?${qs}`);
    },
    adminSuspend(participantId: string, justification: string) {
      return request("POST", "/admin/actions/suspend", { participant_id: participantId, justification });
    },
    adminReactivate(participantId: string, justification: string) {
      return request("POST", "/admin/actions/reactivate", { participant_id: participantId, justification });
    },
    adminClearBan(participantId: string, blockedId: string, justification: string) {
      return request("POST", "/admin/actions/clear-ban", { participant_id: participantId, blocked_participant_id: blockedId, justification });
    },
    adminOverrideTier(participantId: string, newTier: string, justification: string) {
      return request("POST", "/admin/actions/override-tier", { participant_id: participantId, new_tier: newTier, justification });
    },
    adminOverrideScore(participantId: string, newScore: number, justification: string) {
      return request("POST", "/admin/actions/override-score", { participant_id: participantId, new_score: newScore, justification });
    },

    // ─── Pricing Hierarchy ───────────────────────────────
    getPricingHierarchy(participantId: string) {
      return request("GET", `/pricing/hierarchy/${participantId}`);
    },
    upsertPricingLevel(data: unknown) {
      return request("PUT", "/pricing/level", data);
    },
    deletePricingLevel(manifestId: string) {
      return request("DELETE", `/pricing/level/${manifestId}`);
    },
    bulkUploadPricing(entries: unknown[]) {
      return request("POST", "/pricing/bulk-upload", { entries });
    },

    // ─── Approval Rules ─────────────────────────────────
    getApprovalRules() {
      return request("GET", "/approval-rules");
    },
    updateBulkCriteria(data: unknown) {
      return request("PUT", "/approval-rules/bulk-criteria", data);
    },
    updatePerRequestRules(data: unknown) {
      return request("PUT", "/approval-rules/per-request", data);
    },
    testApprovalRules(hypothetical: unknown) {
      return request("POST", "/approval-rules/test", hypothetical);
    },

    // ─── Blocked / Downgrade ────────────────────────────
    listBlocked() {
      return request("GET", "/connections/blocked");
    },
    blockParticipant(targetId: string) {
      return request("POST", "/connections/block", { target_participant_id: targetId });
    },
    unblockParticipant(blockedId: string) {
      return request("DELETE", `/connections/block?blocked_participant_id=${blockedId}`);
    },
    downgradeConnection(connectionId: string) {
      return request("POST", `/connections/${connectionId}/downgrade`);
    },
  };
}
