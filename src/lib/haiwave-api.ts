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
  AuditWizardOptionsResponse,
  AuditExceptionsResponse,
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
  TrustBypassConfig,
  TrustClass,
  TrustBypassActivationRequest,
  TrustBypassDeactivationRequest,
  TrustBypassAffectedCounterparty,
  WatcherRun,
  WatcherResult,
  WatcherRunStatus,
  WatcherRunTriggerRequest,
  WatcherSignalSubscription,
  WatcherSignalSubscriptionPatch,
  QuarterlyScore,
  PeerAggregateResponse,
  VendorRiskDimension,
  VendorRiskResponse,
  RunResumptionState,
  RunTemplate,
  CreateRunTemplateRequest,
  UpdateRunTemplateRequest,
  PhantomDemandAggregate,
  PhantomDemandWindow,
  PhantomDemandScope,
  ParticipantModalityPosture,
  Modality,
  Posture,
  ObservationClass,
  ComplianceChangeFeedResponse,
  ComplianceChangeDetail,
  ComplianceChangeKind,
  WorkingListResponse,
  WorkingListCategory,
  CoverageCurrentResponse,
  CoverageTrend,
  EvidenceDraft as EvidenceDraftWire,
  EvidenceTreeResponse as EvidenceTreeWire,
  Annotation as AnnotationWire,
  AnnotationListResponse as AnnotationListWire,
  CreateAnnotationRequest as CreateAnnotationWire,
  PatchAnnotationRequest as PatchAnnotationWire,
  EvidenceResponse as EvidenceResponseWire,
  EvidenceResponseListResponse as EvidenceResponseListWire,
  ExportResult as ExportResultWire,
  RequestManagementListResponse,
  SearchResponse,
} from '@haiwave/protocol';

import type {
  InboundNominationGroup,
  ResponderQueueFilters,
} from '@/lib/responder-queue-types';

import type {
  DownstreamGapFilters,
} from '@/app/account/sonar/posture/obligations/_lib/types';

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

// v1.30 — Phantom Demand run types. Defined locally (not in @haiwave/protocol)
// because the run table lives in haiCore's private schema. Shapes mirror the
// Drizzle select() return from phantom_demand_runs / phantom_demand_results.
export interface PhantomDemandRun {
  run_id: string;
  initiator_participant_id: string;
  template_id: string | null;
  run_origin: 'ad_hoc' | 'template_manual' | 'template_scheduled' | 'template_event_triggered';
  authorization_basis: 'bilateral';
  status: string;
  scope_snapshot: PhantomDemandScope;
  hop_budget: number;
  hops_consumed: number;
  throttled_at: string | null;
  resumption_count: number;
  cancel_requested_at: string | null;
  cancelled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  triggered_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PhantomDemandResult {
  result_id: string;
  run_id: string;
  sku_id: string;
  responder_participant_id: string;
  payload: Record<string, unknown>;
  synthesis_mode: 'direct' | 'aggregated_derivative' | 'redacted_gap';
  gap: Record<string, unknown> | null;
  response_time_ms: number | null;
  created_at: string;
}

export interface PhantomDemandRunDetail extends PhantomDemandRun {
  results: PhantomDemandResult[];
}

// v1.29 Phase 1 — budget window summary returned by GET /sonar/budget/current.
// Kept in HaiWeb (not protocol) because the route returns it directly without
// Zod-shape validation in haiCore.
//
// v1.30 PR-5 added `is_custom` plus the phantom-demand inbound probe limit
// fields so HaiWeb does not duplicate haiCore's PLATFORM_DEFAULT_* constants
// when rendering "(custom)" vs "(platform default)" labels (spec §7.2).
export interface BudgetStatus {
  participant_id: string;
  window_start: string;
  consumed: number;
  remaining: number;
  budget: number;
  is_custom: boolean;
  phantom_demand_inbound_probe_limit: number;
  phantom_demand_inbound_probe_limit_is_custom: boolean;
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
 * Activation response shape returned by POST /sonar/compliance/trust-bypass/activate.
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
  getQuarterlyScores(
    participantId: string,
    n?: number,
  ): Promise<{ quarters: QuarterlyScore[] }>;
  getPeerAggregate(n?: number): Promise<PeerAggregateResponse>;
  getVendorRisk(
    dimension: VendorRiskDimension,
    n?: number,
  ): Promise<VendorRiskResponse>;
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
  resolveComplianceFlag(flagId: string, notes: string): Promise<Record<string, unknown>>;
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
  // v.1.41 audit-wizard restore: counterparty + SKU picker data source.
  getAuditWizardOptions(): Promise<AuditWizardOptionsResponse>;
  // v.1.41 Audit Exceptions surface: latest non-compliant per (vendor, product).
  getAuditExceptions(opts?: { windowDays?: number }): Promise<AuditExceptionsResponse>;
  // Audit Runs (v1.25)
  triggerAuditRun(body?: RunTriggerRequest): Promise<{ run_id: string; status: string }>;
  refreshVendorAudit(body: RefreshVendorRequest): Promise<{ run_id: string; status: string }>;
  listAuditRuns(opts?: { status?: string; limit?: number; template_id?: string }): Promise<{ runs: AuditRun[] }>;
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
  // ─── Trust bypass (v1.28 Phase 2) ────────────────────────────────────
  listTrustBypassConfigs(): Promise<{ configs: TrustBypassConfig[] }>;
  getTrustBypassAffectedCounterparties(
    trustClass: TrustClass,
  ): Promise<{ counterparties: TrustBypassAffectedCounterparty[] }>;
  activateTrustBypass(body: TrustBypassActivationRequest): Promise<TrustBypassActivationResponse>;
  deactivateTrustBypass(body: TrustBypassDeactivationRequest): Promise<void>;
  // ─── Modality posture (v1.30 PR-3) ───────────────────────────────────
  getModalityPosture(participantId: string): Promise<{ postures: ParticipantModalityPosture[] }>;
  updateModalityPosture(
    participantId: string,
    trustClass: TrustClass,
    modality: Modality,
    posture: Posture,
    signalTypeOverrides?: string[] | null,
  ): Promise<ParticipantModalityPosture>;
  // ─── Watcher (v1.28 Phase 5) ─────────────────────────────────────────
  triggerWatcherRun(body: WatcherRunTriggerRequest): Promise<{ run_id: string; status: WatcherRunStatus }>;
  listWatcherRuns(opts?: { limit?: number; template_id?: string }): Promise<{ runs: WatcherRun[] }>;
  getWatcherRun(runId: string): Promise<{ run: WatcherRun; results: WatcherResult[] }>;
  getWatcherRunStatus(runId: string): Promise<{ status: WatcherRunStatus }>;
  cancelWatcherRun(runId: string): Promise<{ cancelled: boolean }>;
  listWatcherSubscriptions(): Promise<{ subscriptions: WatcherSignalSubscription[] }>;
  patchWatcherSubscription(
    id: string,
    patch: WatcherSignalSubscriptionPatch,
  ): Promise<{ subscription: WatcherSignalSubscription }>;
  // ─── Phantom Demand Runs (v1.30) ─────────────────────────────────────────
  listPhantomDemandRuns(opts: { template_id?: string; limit?: number }): Promise<PhantomDemandRun[]>;
  getPhantomDemandRun(runId: string): Promise<PhantomDemandRunDetail>;
  getPhantomDemandRunStatus(runId: string): Promise<{ status: string; cancel_requested_at: string | null }>;
  cancelPhantomDemandRun(runId: string): Promise<{ ok: true }>;
  triggerPhantomDemand(body: { scope: Record<string, unknown>; template_id?: string | null }): Promise<{ runId: string }>;
  /** Spec §7.7 — per-counterparty PD posture over a rolling window. */
  getPhantomDemandAggregate(opts: { window: PhantomDemandWindow }): Promise<PhantomDemandAggregate>;
  // ─── v1.29 Phase 3 Batch 3a: Run Templates ───────────────────────────────
  listRunTemplates(): Promise<{ templates: RunTemplate[] }>;
  getRunTemplate(templateId: string): Promise<{ template: RunTemplate }>;
  createRunTemplate(body: CreateRunTemplateRequest): Promise<{ template: RunTemplate }>;
  updateRunTemplate(
    templateId: string,
    body: UpdateRunTemplateRequest,
  ): Promise<{ template: RunTemplate }>;
  deleteRunTemplate(templateId: string): Promise<{ deleted: boolean }>;
  triggerRunTemplate(templateId: string): Promise<{ run_id: string }>;
  // ─── v1.30 PR-4: Unified observations list ───────────────────────────
  listObservations(query: {
    tab: ObservationClass;
    status?: string;
    date_range?: string;
    search?: string;
    counterparty?: string;
  }): Promise<{ tab: ObservationClass; runs: unknown[]; templates: unknown[] }>;
  // ─── v1.29 Phase 1: Resumable Execution ──────────────────────────────
  getRunResumptionState(runId: string): Promise<RunResumptionState>;
  getBudgetCurrent(): Promise<BudgetStatus>;
  getThrottledRunsCount(): Promise<{ audit: number; watcher: number; total: number }>;
  getThrottleStatus(): Promise<{
    count: number;
    most_recent_modality: 'audit' | 'watcher' | 'phantom_demand' | null;
  }>;
  // ─── v1.30 PR-5: Usage Page surfaces ────────────────────────────────
  getUsageTimeseries(query?: { window_days?: number }): Promise<{
    buckets: Array<{ window_start: string; hops_consumed: number }>;
  }>;
  getUsageCounterparties(query?: { window_days?: number }): Promise<{
    counterparties: Array<{
      counterparty_id: string;
      counterparty_name: string | null;
      total_hops: number;
      audit_hops: number;
      watcher_hops: number;
      phantom_demand_hops: number;
      last_activity: string;
    }>;
  }>;
  getActiveRuns(): Promise<{
    active_runs: Array<{
      run_id: string;
      observation_class: 'audit' | 'watcher' | 'phantom_demand';
      status: 'running' | 'throttled';
      hops_consumed: number;
      started_at: string | null;
      throttled_at: string | null;
    }>;
  }>;
  getThrottleHistory(query?: { days?: number }): Promise<{
    throttle_history: Array<{
      run_id: string;
      observation_class: 'audit' | 'watcher' | 'phantom_demand';
      throttled_at: string;
      resumption_count: number;
      current_status: string;
    }>;
  }>;
  /** Direct passthrough to haiCore. Used for non-JSON content negotiation
   * (CSV reports). Returns the raw Response so callers can inspect status,
   * forward content-type, and stream the body verbatim. */
  fetchRaw(path: string, init?: RequestInit): Promise<Response>;
  // ─── Compliance change feed (v1.34 P4) ───────────────────────────────
  listComplianceChanges(filters?: {
    kind?: ComplianceChangeKind[];
    partner?: string;
    from?: string;
    to?: string;
  }): Promise<ComplianceChangeFeedResponse>;
  getComplianceChange(changeId: string): Promise<ComplianceChangeDetail>;
  // ─── Coverage (v1.34 P6) ─────────────────────────────────────────────
  getCoverageCurrent(): Promise<CoverageCurrentResponse>;
  getCoverageTrend(windowDays?: number): Promise<CoverageTrend>;
  // ─── Working list (v1.34 P5) ─────────────────────────────────────────
  listWorkingList(filters?: {
    categories?: WorkingListCategory[];
    partner_id?: string;
    status?: 'open' | 'snoozed' | 'dismissed';
    sort?: 'recency' | 'oldest_unresolved';
    page?: number;
    page_size?: number;
  }): Promise<WorkingListResponse>;
  transitionWorkingListItem(
    canonicalKey: string,
    body: { state: 'open' | 'snoozed' | 'dismissed'; snooze_until?: string; dismiss_reason?: string },
  ): Promise<{
    canonical_key: string; state: string; snooze_until: string | null;
    dismiss_reason: string | null; last_transitioned_at: string; last_transitioned_by: string | null;
  }>;
  // ─── Request management (v1.35) ──────────────────────────────────────
  listRequests(filters?: {
    awaiting?: 'me' | 'them' | 'all';
    type?: 'nomination' | 'obligation' | 'all';
    counterparty?: string;
  }): Promise<RequestManagementListResponse>;
  getRequestCounts(): Promise<{
    total: number;
    awaiting_me_count: number;
    awaiting_them_count: number;
    oldest_awaiting_me_age_days: number | null;
  }>;
  listDeclinedRequests(filters?: {
    days?: number;
    all?: boolean;
  }): Promise<RequestManagementListResponse>;
  // ─── Unified Global Search (v1.37) ───────────────────────────────────
  search(q: string, limit?: number): Promise<SearchResponse>;
  // ─── Evidence draft (v1.34 P7) ───────────────────────────────────────
  createEvidenceDraft(body: {
    scope_shape: 'sku_list' | 'product_family' | 'container_with_sku_list';
    skus?: string[];
    family_class_node_id?: string;
    container_ref?: string;
    recipient_name: string;
    recipient_org: string;
    recipient_type: 'customs' | 'customer_audit' | 'regulator' | 'internal_review' | 'other';
    purpose_narrative?: string;
    deadline?: string;
  }): Promise<EvidenceDraftWire>;
  getEvidenceDraft(draftId: string): Promise<EvidenceDraftWire>;
  dispatchEvidenceDraft(
    draftId: string,
    body: { decision: 'cached' | 'fresh' },
  ): Promise<{ dispatch_decision: 'cached' | 'fresh'; bound_run_id: string | null; source_run_ids: string[] | null }>;
  getEvidenceTree(draftId: string): Promise<EvidenceTreeWire>;
  listEvidenceAnnotations(draftId: string): Promise<AnnotationListWire>;
  createEvidenceAnnotation(draftId: string, body: CreateAnnotationWire): Promise<AnnotationWire>;
  patchEvidenceAnnotation(
    draftId: string, annotationId: string, body: PatchAnnotationWire,
  ): Promise<AnnotationWire>;
  exportEvidence(draftId: string): Promise<ExportResultWire>;
  listEvidenceResponses(): Promise<EvidenceResponseListWire>;
  getEvidenceResponse(responseId: string): Promise<EvidenceResponseWire>;
  // document regeneration streams binary/text — handled in the BFF via fetchRaw,
  // not here (request<T>() is JSON-only).
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

    getQuarterlyScores(participantId, n = 5) {
      return request<{ quarters: QuarterlyScore[] }>(
        "GET",
        `/behavioral/score/${participantId}/quarterly?n=${n}`,
      );
    },

    getPeerAggregate(n = 5) {
      return request<PeerAggregateResponse>(
        "GET",
        `/behavioral/peer-aggregate?n=${n}`,
      );
    },

    getVendorRisk(dimension, n = 5) {
      return request<VendorRiskResponse>(
        "GET",
        `/behavioral/vendor-risk?dimension=${dimension}&n=${n}`,
      );
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
    async getPricingHierarchy(participantId: string) {
      const env = await request<{ participant_id: string; levels: Record<string, unknown>[] }>(
        "GET",
        `/pricing/hierarchy/${participantId}`,
      );
      return env.levels ?? [];
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
    async listBlocked() {
      const env = await request<{ blocked: Record<string, unknown>[] }>(
        "GET",
        "/connections/blocked",
      );
      return env.blocked ?? [];
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
    async getSellSideOrders(statusFilter?: string) {
      const qs = statusFilter ? `?status=${statusFilter}` : "";
      const env = await request<{ items: Record<string, unknown>[]; total_count: number }>(
        "GET",
        `/orders/sell-side${qs}`,
      );
      return env.items;
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
      return request<Record<string, unknown>>(
        "GET",
        `/provenance/manifest/${encodeURIComponent(productId)}`,
      );
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
    resolveComplianceFlag(flagId: string, notes: string) {
      return request<Record<string, unknown>>("POST", `/noncompliance/flags/${flagId}/resolve`, { notes });
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
    getAuditWizardOptions() {
      return request<AuditWizardOptionsResponse>('GET', '/audit-scopes/wizard-options');
    },
    getAuditExceptions(opts = {}) {
      const qs =
        opts.windowDays !== undefined ? `?window_days=${opts.windowDays}` : '';
      return request<AuditExceptionsResponse>('GET', `/sonar/audit/exceptions${qs}`);
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
      ).then((res) => {
        if (!opts.template_id) return res;
        return { runs: res.runs.filter((r) => r.template_id === opts.template_id) };
      });
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
        '@/lib/responder-queue'
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

    // ─── Trust bypass (v1.28 Phase 2) ────────────────────────────────────
    listTrustBypassConfigs() {
      return request<{ configs: TrustBypassConfig[] }>(
        'GET',
        '/sonar/compliance/trust-bypass/configs',
      );
    },
    getTrustBypassAffectedCounterparties(trustClass) {
      return request<{ counterparties: TrustBypassAffectedCounterparty[] }>(
        'GET',
        `/sonar/compliance/trust-bypass/affected-counterparties?trust_class=${encodeURIComponent(trustClass)}`,
      );
    },
    activateTrustBypass(body) {
      return request<TrustBypassActivationResponse>(
        'POST',
        '/sonar/compliance/trust-bypass/activate',
        body,
      );
    },
    deactivateTrustBypass(body) {
      // haiCore returns 204 No Content; request<T>() returns null for non-JSON.
      return request<void>('POST', '/sonar/compliance/trust-bypass/deactivate', body);
    },

    // ─── Modality posture (v1.30 PR-3) ───────────────────────────────────
    getModalityPosture(participantId) {
      return request<{ postures: ParticipantModalityPosture[] }>(
        'GET',
        `/participants/${participantId}/modality-posture`,
      );
    },
    updateModalityPosture(participantId, trustClass, modality, posture, signalTypeOverrides) {
      return request<ParticipantModalityPosture>(
        'PUT',
        `/participants/${participantId}/modality-posture/${trustClass}/${modality}`,
        { posture, signal_type_overrides: signalTypeOverrides ?? null },
      );
    },

    // ─── Watcher (v1.28 Phase 5) ────────────────────────────────────────
    triggerWatcherRun(body) {
      return request<{ run_id: string; status: WatcherRunStatus }>(
        'POST',
        '/sonar/watcher/runs',
        body,
      );
    },
    listWatcherRuns(opts = {}) {
      const params = new URLSearchParams();
      if (opts.limit !== undefined) params.set('limit', String(opts.limit));
      const q = params.toString();
      return request<{ runs: WatcherRun[] }>(
        'GET',
        `/sonar/watcher/runs${q ? `?${q}` : ''}`,
      ).then((res) => {
        if (!opts.template_id) return res;
        return { runs: res.runs.filter((r) => r.template_id === opts.template_id) };
      });
    },
    getWatcherRun(runId) {
      return request<{ run: WatcherRun; results: WatcherResult[] }>(
        'GET',
        `/sonar/watcher/runs/${runId}`,
      );
    },
    getWatcherRunStatus(runId) {
      return request<{ status: WatcherRunStatus }>(
        'GET',
        `/sonar/watcher/runs/${runId}/status`,
      );
    },
    cancelWatcherRun(runId) {
      return request<{ cancelled: boolean }>(
        'POST',
        `/sonar/watcher/runs/${runId}/cancel`,
      );
    },

    // ─── Phantom Demand Runs (v1.30) ─────────────────────────────────────────
    listPhantomDemandRuns(opts: { template_id?: string; limit?: number }) {
      const params = new URLSearchParams();
      if (opts.template_id) params.set('template_id', opts.template_id);
      if (opts.limit !== undefined) params.set('limit', String(opts.limit));
      const q = params.toString();
      return request<PhantomDemandRun[]>(
        'GET',
        `/sonar/phantom-demand/runs${q ? `?${q}` : ''}`,
      );
    },
    getPhantomDemandRun(runId: string) {
      return request<PhantomDemandRunDetail>(
        'GET',
        `/sonar/phantom-demand/runs/${runId}`,
      );
    },
    getPhantomDemandRunStatus(runId: string) {
      return request<{ status: string; cancel_requested_at: string | null }>(
        'GET',
        `/sonar/phantom-demand/runs/${runId}/status`,
      );
    },
    cancelPhantomDemandRun(runId: string) {
      return request<{ ok: true }>(
        'POST',
        `/sonar/phantom-demand/runs/${runId}/cancel`,
        {},
      );
    },
    async triggerPhantomDemand(body: { scope: Record<string, unknown>; template_id?: string | null }) {
      const r = await request<{ run_id: string }>(
        'POST',
        '/sonar/phantom-demand/runs',
        body,
      );
      return { runId: r.run_id };
    },
    getPhantomDemandAggregate(opts: { window: PhantomDemandWindow }) {
      return request<PhantomDemandAggregate>(
        'GET',
        `/sonar/phantom-demand/aggregate?window=${encodeURIComponent(opts.window)}`,
      );
    },

    // ─── v1.29 Phase 3 Batch 3a: Run Templates ─────────────────────
    listRunTemplates() {
      return request<{ templates: RunTemplate[] }>('GET', '/sonar/templates');
    },
    getRunTemplate(templateId) {
      return request<{ template: RunTemplate }>(
        'GET',
        `/sonar/templates/${templateId}`,
      );
    },
    createRunTemplate(body) {
      return request<{ template: RunTemplate }>(
        'POST',
        '/sonar/templates',
        body,
      );
    },
    updateRunTemplate(templateId, body) {
      return request<{ template: RunTemplate }>(
        'PATCH',
        `/sonar/templates/${templateId}`,
        body,
      );
    },
    deleteRunTemplate(templateId) {
      return request<{ deleted: boolean }>(
        'DELETE',
        `/sonar/templates/${templateId}`,
      );
    },
    triggerRunTemplate(templateId) {
      return request<{ run_id: string }>(
        'POST',
        `/sonar/templates/${templateId}/trigger`,
      );
    },

    // ─── v1.30 PR-4: Unified observations list ─────────────────────
    async listObservations(query) {
      const qs = new URLSearchParams({ tab: query.tab });
      if (query.status) qs.set('status', query.status);
      if (query.date_range) qs.set('date_range', query.date_range);
      if (query.search) qs.set('search', query.search);
      if (query.counterparty) qs.set('counterparty', query.counterparty);
      return request<{ tab: ObservationClass; runs: unknown[]; templates: unknown[] }>(
        'GET',
        `/sonar/observations?${qs.toString()}`,
      );
    },

    listWatcherSubscriptions() {
      return request<{ subscriptions: WatcherSignalSubscription[] }>(
        'GET',
        '/sonar/watcher/subscriptions',
      );
    },
    patchWatcherSubscription(id, patch) {
      return request<{ subscription: WatcherSignalSubscription }>(
        'PATCH',
        `/sonar/watcher/subscriptions/${id}`,
        patch,
      );
    },

    // ─── v1.29 Phase 1: Resumable Execution ─────────────────────────────
    getRunResumptionState(runId) {
      return request<RunResumptionState>('GET', `/sonar/runs/${runId}/resumption-state`);
    },
    getBudgetCurrent() {
      return request<BudgetStatus>('GET', '/sonar/budget/current');
    },
    getThrottledRunsCount() {
      return request<{ audit: number; watcher: number; total: number }>(
        'GET',
        '/sonar/runs/throttled/count',
      );
    },
    getThrottleStatus() {
      return request<{
        count: number;
        most_recent_modality: 'audit' | 'watcher' | 'phantom_demand' | null;
      }>('GET', '/account/throttle-status');
    },

    // ─── v1.30 PR-5: Usage Page surfaces ───────────────────────────────
    getUsageTimeseries(query = {}) {
      const qs = new URLSearchParams();
      if (query.window_days !== undefined) qs.set('window_days', String(query.window_days));
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      return request<{ buckets: Array<{ window_start: string; hops_consumed: number }> }>(
        'GET',
        `/sonar/usage/timeseries${suffix}`,
      );
    },
    getUsageCounterparties(query = {}) {
      const qs = new URLSearchParams();
      if (query.window_days !== undefined) qs.set('window_days', String(query.window_days));
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      return request<{
        counterparties: Array<{
          counterparty_id: string;
          counterparty_name: string | null;
          total_hops: number;
          audit_hops: number;
          watcher_hops: number;
          phantom_demand_hops: number;
          last_activity: string;
        }>;
      }>('GET', `/sonar/usage/counterparties${suffix}`);
    },
    getActiveRuns() {
      return request<{
        active_runs: Array<{
          run_id: string;
          observation_class: 'audit' | 'watcher' | 'phantom_demand';
          status: 'running' | 'throttled';
          hops_consumed: number;
          started_at: string | null;
          throttled_at: string | null;
        }>;
      }>('GET', '/sonar/usage/active-runs');
    },
    getThrottleHistory(query = {}) {
      const qs = new URLSearchParams();
      if (query.days !== undefined) qs.set('days', String(query.days));
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      return request<{
        throttle_history: Array<{
          run_id: string;
          observation_class: 'audit' | 'watcher' | 'phantom_demand';
          throttled_at: string;
          resumption_count: number;
          current_status: string;
        }>;
      }>('GET', `/sonar/usage/throttle-history${suffix}`);
    },

    // ─── Compliance change feed (v1.34 P4) ───────────────────────────────
    listComplianceChanges(filters: {
      kind?: ComplianceChangeKind[]; partner?: string; from?: string; to?: string;
    } = {}) {
      const p = new URLSearchParams();
      (filters.kind ?? []).forEach((k) => p.append('kind', k));
      if (filters.partner) p.set('partner', filters.partner);
      if (filters.from) p.set('from', filters.from);
      if (filters.to) p.set('to', filters.to);
      const qs = p.toString();
      return request<ComplianceChangeFeedResponse>(
        'GET', `/sonar/compliance/changes${qs ? `?${qs}` : ''}`,
      ).then((d) => {
        if (d == null) throw new Error('listComplianceChanges: haiCore returned no/non-JSON body');
        return d;
      });
    },
    getComplianceChange(changeId: string) {
      return request<ComplianceChangeDetail>(
        'GET', `/sonar/compliance/changes/${encodeURIComponent(changeId)}`,
      ).then((d) => {
        if (d == null) throw new Error('getComplianceChange: haiCore returned no/non-JSON body');
        return d;
      });
    },

    // ─── Coverage (v1.34 P6) ─────────────────────────────────────────────
    getCoverageCurrent() {
      return request<CoverageCurrentResponse>('GET', '/sonar/compliance/coverage/current')
        .then((d) => {
          if (d == null) throw new Error('getCoverageCurrent: haiCore returned no/non-JSON body');
          return d;
        });
    },
    getCoverageTrend(windowDays?: number) {
      const qs = windowDays !== undefined ? `?window_days=${encodeURIComponent(String(windowDays))}` : '';
      return request<CoverageTrend>('GET', `/sonar/compliance/coverage/trend${qs}`)
        .then((d) => {
          if (d == null) throw new Error('getCoverageTrend: haiCore returned no/non-JSON body');
          return d;
        });
    },

    // ─── Working list (v1.34 P5) ─────────────────────────────────────────
    listWorkingList(filters: {
      categories?: WorkingListCategory[]; partner_id?: string;
      status?: 'open' | 'snoozed' | 'dismissed';
      sort?: 'recency' | 'oldest_unresolved'; page?: number; page_size?: number;
    } = {}) {
      const p = new URLSearchParams();
      if (filters.categories?.length) p.set('categories', filters.categories.join(','));
      if (filters.partner_id) p.set('partner_id', filters.partner_id);
      if (filters.status) p.set('status', filters.status);
      if (filters.sort) p.set('sort', filters.sort);
      if (filters.page !== undefined) p.set('page', String(filters.page));
      if (filters.page_size !== undefined) p.set('page_size', String(filters.page_size));
      const qs = p.toString();
      return request<WorkingListResponse>(
        'GET', `/sonar/compliance/working-list${qs ? `?${qs}` : ''}`,
      ).then((d) => {
        if (d == null) throw new Error('listWorkingList: haiCore returned no/non-JSON body');
        return d;
      });
    },
    transitionWorkingListItem(
      canonicalKey: string,
      body: { state: 'open' | 'snoozed' | 'dismissed'; snooze_until?: string; dismiss_reason?: string },
    ) {
      return request<{
        canonical_key: string; state: string; snooze_until: string | null;
        dismiss_reason: string | null; last_transitioned_at: string; last_transitioned_by: string | null;
      }>('PUT', `/sonar/compliance/working-list/items/${encodeURIComponent(canonicalKey)}/state`, body).then((d) => {
        if (d == null) throw new Error('transitionWorkingListItem: haiCore returned no/non-JSON body');
        return d;
      });
    },

    // ─── Request management (v1.35) ──────────────────────────────────────
    listRequests(filters = {}) {
      const p = new URLSearchParams();
      if (filters.awaiting) p.set('awaiting', filters.awaiting);
      if (filters.type) p.set('type', filters.type);
      if (filters.counterparty) p.set('counterparty', filters.counterparty);
      const qs = p.toString();
      return request<RequestManagementListResponse>(
        'GET', `/sonar/compliance/requests${qs ? `?${qs}` : ''}`,
      ).then((d) => {
        if (d == null) throw new Error('listRequests: haiCore returned no/non-JSON body');
        return d;
      });
    },
    getRequestCounts() {
      return request<{
        total: number;
        awaiting_me_count: number;
        awaiting_them_count: number;
        oldest_awaiting_me_age_days: number | null;
      }>('GET', '/sonar/compliance/requests/counts').then((d) => {
        if (d == null) throw new Error('getRequestCounts: haiCore returned no/non-JSON body');
        return d;
      });
    },
    listDeclinedRequests(filters = {}) {
      const p = new URLSearchParams();
      if (filters.days !== undefined) p.set('days', String(filters.days));
      if (filters.all) p.set('all', 'true');
      const qs = p.toString();
      return request<RequestManagementListResponse>(
        'GET', `/sonar/compliance/requests/declined${qs ? `?${qs}` : ''}`,
      ).then((d) => {
        if (d == null) throw new Error('listDeclinedRequests: haiCore returned no/non-JSON body');
        return d;
      });
    },

    // ─── Unified Global Search (v1.37) ───────────────────────────────────
    search(q, limit) {
      const p = new URLSearchParams();
      p.set('q', q);
      if (limit !== undefined) p.set('limit', String(limit));
      return request<SearchResponse>('GET', `/search?${p.toString()}`).then((d) => {
        if (d == null) throw new Error('search: haiCore returned no/non-JSON body');
        return d;
      });
    },

    // ─── Evidence draft (v1.34 P7) ───────────────────────────────────────
    createEvidenceDraft(body) {
      return request<EvidenceDraftWire>('POST', '/sonar/compliance/evidence/draft', body).then((d) => {
        if (d == null) throw new Error('createEvidenceDraft: haiCore returned no/non-JSON body');
        return d;
      });
    },
    getEvidenceDraft(draftId) {
      return request<EvidenceDraftWire>('GET', `/sonar/compliance/evidence/draft/${encodeURIComponent(draftId)}`).then((d) => {
        if (d == null) throw new Error('getEvidenceDraft: haiCore returned no/non-JSON body');
        return d;
      });
    },
    dispatchEvidenceDraft(draftId, body) {
      return request<{ dispatch_decision: 'cached' | 'fresh'; bound_run_id: string | null; source_run_ids: string[] | null }>(
        'POST', `/sonar/compliance/evidence/draft/${encodeURIComponent(draftId)}/dispatch`, body,
      ).then((d) => {
        if (d == null) throw new Error('dispatchEvidenceDraft: haiCore returned no/non-JSON body');
        return d;
      });
    },
    getEvidenceTree(draftId) {
      return request<EvidenceTreeWire>(
        'GET', `/sonar/compliance/evidence/draft/${encodeURIComponent(draftId)}/tree`,
      ).then((d) => {
        if (d == null) throw new Error('getEvidenceTree: haiCore returned no/non-JSON body');
        return d;
      });
    },
    listEvidenceAnnotations(draftId) {
      return request<AnnotationListWire>(
        'GET', `/sonar/compliance/evidence/draft/${encodeURIComponent(draftId)}/annotations`,
      ).then((d) => {
        if (d == null) throw new Error('listEvidenceAnnotations: haiCore returned no/non-JSON body');
        return d;
      });
    },
    createEvidenceAnnotation(draftId, body) {
      return request<AnnotationWire>(
        'POST', `/sonar/compliance/evidence/draft/${encodeURIComponent(draftId)}/annotations`, body,
      ).then((d) => {
        if (d == null) throw new Error('createEvidenceAnnotation: haiCore returned no/non-JSON body');
        return d;
      });
    },
    patchEvidenceAnnotation(draftId, annotationId, body) {
      return request<AnnotationWire>(
        'PATCH',
        `/sonar/compliance/evidence/draft/${encodeURIComponent(draftId)}/annotations/${encodeURIComponent(annotationId)}`,
        body,
      ).then((d) => {
        if (d == null) throw new Error('patchEvidenceAnnotation: haiCore returned no/non-JSON body');
        return d;
      });
    },
    exportEvidence(draftId) {
      return request<ExportResultWire>(
        'POST', `/sonar/compliance/evidence/draft/${encodeURIComponent(draftId)}/export`, {},
      ).then((d) => { if (d == null) throw new Error('exportEvidence: haiCore returned no/non-JSON body'); return d; });
    },
    listEvidenceResponses() {
      return request<EvidenceResponseListWire>(
        'GET', '/sonar/compliance/evidence/responses',
      ).then((d) => { if (d == null) throw new Error('listEvidenceResponses: haiCore returned no/non-JSON body'); return d; });
    },
    getEvidenceResponse(responseId) {
      return request<EvidenceResponseWire>(
        'GET', `/sonar/compliance/evidence/responses/${encodeURIComponent(responseId)}`,
      ).then((d) => { if (d == null) throw new Error('getEvidenceResponse: haiCore returned no/non-JSON body'); return d; });
    },

    // INVARIANT: returns the raw Response and does NOT throw on non-OK
    // status (unlike request<T>()). Callers — see the phantom-demand report
    // and evidence document BFF route handlers — rely on this to manually
    // decide JSON vs error fallthrough, typically forwarding 4xx body
    // verbatim and converting unexpected network failures to 500.
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
  ClassRollupEntry,
  TrustBypassConfig,
  TrustClass,
  TrustBypassActivationRequest,
  TrustBypassDeactivationRequest,
  TrustBypassAffectedCounterparty,
  TrustBypassActivationMode,
  RunResumptionState,
} from '@haiwave/protocol';
