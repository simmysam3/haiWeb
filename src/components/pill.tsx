'use client';
import { useId, useState } from 'react';

// ── Embedded definitions. Edit copy here. (category → value → definition) ──
const PILL_DEFINITIONS: Record<string, Record<string, string>> = {
  attestation_kind: {
    first_party_self_declared:
      "The vendor's own origin-manifest declaration, with no external verification.",
    third_party_audited:
      'The vendor holds a third-party audit certificate referenced in their origin manifest.',
    regulator_attested:
      'The vendor holds a regulator-issued attestation referenced in their origin manifest.',
    verified_out_of_band:
      'The responder has annotated this node with an out-of-band attestation they hold directly.',
    unsubstantiated_gap:
      'No attestation is available; this node is declared as a known unverified gap.',
  },
  run_status: {
    running: 'The run is in progress.',
    complete: 'The run finished and all targets were observed.',
    partial: 'The run finished but some targets could not be observed.',
    failed: 'The run stopped before completing. See the reason for the specific failure.',
    cancelled: 'The run was cancelled by an operator before completing.',
    throttled: 'The run paused because its hop budget was exhausted; it will resume automatically.',
  },
  run_origin: {
    ad_hoc: 'Triggered manually with no associated run template.',
    template_manual: 'Triggered manually from a saved run template.',
    template_scheduled: 'Fired automatically on the template\'s configured schedule.',
    template_event_triggered: 'Fired automatically when the template\'s trigger event occurred.',
    evidence_response: 'Triggered as part of an evidence response dispatch.',
  },
  probe_status: {
    complete: 'The responder returned a full quote for this SKU.',
    partial: 'The responder returned a partial response (some fields missing).',
    declined: 'The responder declined to quote this SKU.',
    gap: 'No response was recorded — the probe was redacted or the responder was unreachable.',
    unknown: 'The responder completeness was not reported.',
  },
  probe_verdict: {
    full: 'The supplier indicated it can meet the full hypothetical quantity.',
    partial: 'The supplier can cover only part of the hypothetical ask.',
    declined: 'The supplier indicated it would not fulfill this hypothetical request.',
    no_answer:
      'No usable reply was obtained — missing data, not a decline. Supplier availability is unknown.',
    unusable: 'A response arrived but could not be interpreted.',
  },
  status: {
    active: 'Active and in good standing.',
    trading_pair: 'A bilaterally established trading relationship.',
    approved: 'Reviewed and approved.',
    paid: 'Payment received in full.',
    online: 'Reachable and responding.',
    pass: 'Met the evaluated criteria.',
    pending: 'Awaiting action or review.',
    pending_payment: 'Awaiting payment.',
    open: 'Open and unresolved.',
    probation: 'Permitted but under heightened scrutiny.',
    jailed: 'Temporarily restricted due to policy violation.',
    suspended: 'Access suspended.',
    past_due: 'Payment is overdue.',
    banned: 'Permanently blocked from the network.',
    enabled: 'Enabled and will fire on its configured cadence.',
    disabled: 'Disabled and non-functional.',
    fail: 'Did not meet the evaluated criteria.',
    completed: 'Finished successfully.',
    failed: 'Did not complete successfully.',
    cancelled: 'Cancelled before completion.',
    offline: 'Not reachable.',
    none: 'No value set.',
    void: 'Voided and no longer valid.',
    warning: 'A warning condition that requires attention.',
    verified: 'Verified and confirmed authentic.',
    unverified: 'Not yet verified.',
    account_owner: 'The account owner; full administrative control.',
    procurement_transact: 'Procurement role permitted to transact.',
    buyer_full_transact: 'Buyer role with full transaction rights.',
    inside_sales_transact: 'Inside sales role permitted to transact.',
    buyer_request_quote: 'Buyer role limited to requesting quotes.',
    procurement_read_only: 'Procurement role with read-only access.',
    buyer_view_only: 'Buyer role with view-only access.',
    inside_sales_read_only: 'Inside sales role with read-only access.',
    processed: 'The transaction has been processed and recorded.',
    quoted: 'A quote has been issued to the requesting party.',
    accepted: 'The order or quote has been accepted by the counterparty.',
  },
  resolution_class: {
    agentic_eligible: 'The gap can be resolved agent-to-agent on the HAIWAVE network.',
    out_of_band: 'Resolution requires off-network outreach (the counterparty is not a participant).',
    pending: 'Resolution path not yet determined.',
  },
  resolution_status: {
    compliant: 'All audited products met origin/disclosure requirements.',
    partially_compliant: 'Some audited products have unresolved gaps.',
    non_compliant: 'Audited products failed origin/disclosure requirements.',
  },
  risk: {
    normal: 'Risk score within the expected range.',
    elevated: 'Risk score above normal; warrants attention.',
    critical: 'Risk score critically high; immediate attention warranted.',
  },
  throttle: {
    throttled: 'The run paused because its hop budget was exhausted; it will resume automatically.',
  },
  // Snake_case keys are the protocol-shaped values used by run-detail and
  // audit-log surfaces. LT / CAP / DEL are compact-chip codes added in v.1.43
  // Plan 2 for <CounterpartiesGrid>, <WatcherScopePicker> checkboxes, and the
  // watcher column packs. Both forms resolve so neither surface drops to the
  // missing-definition console.warn.
  signal_type: {
    lead_time_distribution: 'p50 / p75 / p90 / p95 / p99 fulfilment lead time over the last 90 days.',
    capacity_utilization_band: 'Latest reported production band: low, moderate, high, or at_capacity.',
    delivery_event: 'Most recent shipment status — dispatched, in transit, delayed, delivered, or exception. Premier-tier counterparties only.',
    LT: 'p50 / p75 / p90 / p95 / p99 fulfilment lead time over the last 90 days.',
    CAP: 'Latest reported production band: low, moderate, high, or at_capacity.',
    DEL: 'Most recent shipment status — dispatched, in transit, delayed, delivered, or exception.',
    // v.1.43 Plan 3 — per-product lead-time signals surfaced alongside LT on the
    // watcher CounterpartiesGrid. PLT/QLT complement the calibrated LT distribution
    // with the vendor's own published baseline and a fresh quote for an order today.
    PLT: 'Published lead time — vendor\'s stated/advertised lead time (the contract baseline).',
    QLT: 'Quoted lead time — what the vendor would commit to for a new order placed today.',
  },
  config_provenance: {
    fixed_at_creation: 'Set when the configuration was created and immutable thereafter; only schedule and lifecycle fields can be edited.',
  },
  // Mirror of CHANGE_KIND_DEFINITION from @haiwave/protocol (v1.34 §3.4 — Pill tooltip source of truth). Cannot value-import the CJS protocol pkg in a client component (Turbopack + file: symlink on Windows). Keep verbatim in sync with packages/protocol/src/audit/compliance-changes.ts.
  change_kind: {
    gap_added: 'A new gap is present at a cell that was previously traversable.',
    gap_resolved: 'A previously open gap is no longer present.',
    origin_shifted_country: 'Country of origin changed for this vendor/product.',
    origin_shifted_plant: 'Plant identifier changed within the same country.',
    vendor_substituted: 'A subcomponent vendor changed.',
    lead_time_degraded: 'Lead time increased beyond the degradation threshold.',
    lead_time_improved: 'Lead time decreased beyond the degradation threshold.',
    certification_expired_or_revoked: 'A referenced certification became expired or revoked.',
    certification_renewed: 'Certification status returned to valid.',
    depth_reduced: 'Maximum traversal depth decreased for this product.',
    depth_increased: 'Maximum traversal depth increased for this product.',
  },
  severity: {
    info: 'Informational change; no immediate action required.',
    warning: 'Notable change that may require review.',
    critical: 'High-impact change that requires immediate attention.',
  },
  // sync with @haiwave/protocol WORKING_LIST_CATEGORY_DEFINITION
  working_list_category: {
    gap: 'An open compliance gap from the latest snapshot.',
    change: 'A just-broken change event detected between snapshots.',
    nomination: 'An outgoing vendor nomination awaiting response.',
    obligation: 'An incoming customer request awaiting your response.',
    expiry: 'A provenance key expiring within the warning window.',
  },
  // sync with @haiwave/protocol EVIDENCE_SCOPE_SHAPE_DEFINITION (v1.34 P7)
  evidence_scope_shape: {
    sku_list: 'Scope is an explicit list of SKUs.',
    product_family: 'Scope is every catalog SKU assigned to a chosen product class.',
    container_with_sku_list: 'A container/shipment reference annotates an explicit SKU list.',
  },
  // sync with @haiwave/protocol EVIDENCE_RECIPIENT_TYPE_DEFINITION (v1.34 P7)
  evidence_recipient_type: {
    customs: 'A customs authority (e.g. CBP).',
    customer_audit: 'A customer running a supplier audit.',
    regulator: 'A government regulator.',
    internal_review: 'An internal compliance review.',
    other: 'Another recipient type.',
  },
  // sync with @haiwave/protocol EVIDENCE_DISPATCH_DECISION_DEFINITION (v1.34 P7)
  evidence_dispatch_decision: {
    cached: 'Reuses the most recent applicable completed audit run per SKU.',
    fresh: 'Triggers a new audit run scoped to the entered SKUs.',
  },
  // v1.35 Request Management — item-type pills on each RequestRow.
  // Mirror of @haiwave/protocol RequestManagementItemTypeSchema (3 values, no outbound_obligation by design — see request-management.ts Q3 comment).
  'request-type': {
    inbound_nomination:
      'A counterparty has nominated you for an audit scope. Accept to allow audits, decline to refuse.',
    outbound_nomination: 'You nominated this counterparty. Awaiting their decision.',
    inbound_obligation:
      'A counterparty is asking you to fulfill a SKU-level compliance obligation.',
  },
  // v1.47 Secure Supplier Registration — jurisdiction risk tier on a pending
  // registration request (synchronous jurisdiction screen). Severity-coded
  // (info/warn/problem), never orange (orange is nav-only).
  risk_tier: {
    standard: 'Domestic jurisdiction — standard review.',
    elevated: 'Foreign jurisdiction — elevated review.',
    blocked: 'Sanctioned jurisdiction — approval requires an audited override.',
    // Literal display pills (see RiskTierPills): elevated renders as "Foreign";
    // blocked renders as "Foreign" + "Sanctioned".
    foreign: 'Foreign jurisdiction — elevated review.',
    sanctioned: 'Sanctioned jurisdiction — approval requires an audited override.',
  },
  // v1.47 — adjudication state of a registration request.
  registration_status: {
    pending_approval: 'Awaiting gatekeeper adjudication.',
    approved: 'Approved; a participant identity has been provisioned.',
    rejected: 'Rejected; applicant PII is redacted to a tombstone.',
  },
  // Company Library Phase B — lifecycle status of a library artifact/attribute.
  library_status: {
    draft: 'Gathered or uploaded, awaiting admin confirmation.',
    active: 'Current and in effect.',
    expired: 'Validity date has passed — refresh the document or value.',
    artifact_missing: 'Claimed by the company; no supporting document attached yet.',
    superseded: 'Replaced by a newer version.',
    revoked: 'Withdrawn by an administrator.',
  },
  // Company Library Phase B — provenance tier of a library element's evidence.
  library_source: {
    self_declared: 'Entered by the company without supporting evidence.',
    auto_gathered: "Collected automatically from the company's public web presence.",
    document_backed: 'Supported by a document on file.',
    verified: 'Confirmed by a third party.',
  },
  // Entity Approvals (spec 2026-06-11) — per-requirement evaluation status on the
  // review scorecard.
  eval_status: {
    met: 'The requirement is satisfied by an active, unexpired item.',
    claimed: 'Claimed by the counterparty but no supporting document is attached (Artifact Missing). Not counted as a gap.',
    insufficient: 'Held, but the coverage amount is below the required minimum.',
    expired: 'An item is held but its validity date has passed.',
    missing: 'Nothing is held against this requirement.',
    waived: 'An administrator waived this requirement out of band. Not counted as a gap.',
    not_shared: "The counterparty's sharing policy hides this element at the evaluation tier — request it out of band.",
  },
  // Entity Approvals (spec 2026-06-11) — decision state of a counterparty in the
  // reviewer's approvals queue.
  approval_status: {
    pending: 'A submission awaiting your review and decision.',
    approved: 'You approved this counterparty to a HAIWAVE tier.',
    revoked: 'You withdrew this counterparty\'s tier and blocked the connection.',
  },
  // v1.44 Phantom Demand — BOM feasibility verdict for a phantom-demand probe
  // run. Synthesised server-side from worst-case lead-time analysis.
  pd_verdict: {
    'on-time': 'Worst-case lead time meets the target date.',
    marginal: 'Lead time is close to the target date — review the detail.',
    wall: 'At least one line is blocked (no bilateral access, depth cap, or declined).',
    infeasible: 'Lead time exceeds the target date even on the best path.',
  },
  // P5 Vomero — per-component-line readiness outcome (spec §6.2).
  // Tones: available → success; quantity_short / shade_risk / length_gap /
  // lead_time_shift → warn; hard_gap → problem. No orange (nav-only).
  readiness: {
    available: 'This component line is fully available at the required quantity and lead time.',
    quantity_short: 'Holding suppliers cannot cover the full run quantity for this component.',
    shade_risk: 'A dye-lot or shade deviation has been flagged for this component.',
    length_gap: 'Required length is not available from current holding suppliers.',
    lead_time_shift: 'Lead time has shifted beyond the acceptable threshold for this component.',
    hard_gap: 'No holding supplier exists for this component — sourcing action required.',
  },
};

const _warnedKeys = new Set<string>();

const TITLE_CASE = (v: string) =>
  v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, ' ');

export interface PillProps {
  category?: string;
  value?: string;
  /** Dynamic per-instance description for error/failure states (e.g. run.error_message). */
  detail?: string | null;
  /** Explicit definition; overrides the map (for one-off pills). */
  definition?: string;
  /** Visual variant. Defaults derived from category+value when omitted. */
  tone?: 'success' | 'warn' | 'problem' | 'info' | 'neutral';
  className?: string;
  children?: React.ReactNode;
}

const TONE_CLASS: Record<NonNullable<PillProps['tone']>, string> = {
  success: 'bg-success/10 text-success',
  warn: 'bg-warning/10 text-warning',
  problem: 'bg-problem/10 text-problem',
  info: 'bg-teal/10 text-teal-dark',
  neutral: 'bg-slate/10 text-slate',
};

function deriveTone(category?: string, value?: string): NonNullable<PillProps['tone']> {
  const v = value ?? '';
  if (['failed', 'fail', 'non_compliant', 'banned', 'suspended', 'past_due', 'disabled', 'critical', 'jailed'].includes(v)) return 'problem';
  if (['pending', 'partial', 'partially_compliant', 'probation', 'open', 'pending_payment', 'elevated', 'throttled', 'out_of_band', 'warning'].includes(v)) return 'warn';
  if (['complete', 'completed', 'active', 'approved', 'paid', 'online', 'pass', 'compliant', 'trading_pair', 'accepted', 'normal', 'verified', 'enabled'].includes(v)) return 'success';
  // run_origin tones: scheduled/event triggers are info (intentional automation); ad_hoc/manual = neutral
  if (category === 'run_origin') {
    if (v === 'template_scheduled' || v === 'template_event_triggered') return 'info';
    if (v === 'evidence_response') return 'warn';
  }
  if (category === 'resolution_class' && v === 'agentic_eligible') return 'info';
  // working_list_category severity coding
  if (category === 'working_list_category') {
    if (['gap', 'obligation', 'expiry'].includes(v)) return 'warn';
    if (v === 'change') return 'info';
    // nomination → neutral
  }
  // v1.35 request-type tones — match working_list_category severity coding
  if (category === 'request-type') {
    if (v === 'inbound_obligation') return 'warn';
    if (v === 'inbound_nomination' || v === 'outbound_nomination') return 'info';
  }
  // v1.47 risk_tier tones: standard = info (teal), elevated = warn, blocked = problem (red).
  // Severity tones only — never orange (nav-only).
  if (category === 'risk_tier') {
    if (v === 'standard') return 'info';
    if (v === 'elevated' || v === 'foreign') return 'warn';
    if (v === 'blocked' || v === 'sanctioned') return 'problem';
  }
  if (category === 'registration_status') {
    if (v === 'approved') return 'success';
    if (v === 'rejected') return 'problem';
    if (v === 'pending_approval') return 'warn';
  }
  // Company Library Phase B — library_status tones: active = green, draft = amber,
  // expired/revoked = red, superseded = neutral.
  if (category === 'library_status') {
    if (v === 'active') return 'success';
    if (v === 'draft' || v === 'artifact_missing') return 'warn';
    if (v === 'expired' || v === 'revoked') return 'problem';
    if (v === 'superseded') return 'neutral';
  }
  // Company Library Phase B — library_source tones: document_backed/verified = green,
  // auto_gathered = info (teal), self_declared = neutral.
  if (category === 'library_source') {
    if (v === 'document_backed' || v === 'verified') return 'success';
    if (v === 'auto_gathered') return 'info';
    if (v === 'self_declared') return 'neutral';
  }
  // Entity Approvals eval_status tones: met = success, claimed/insufficient = warn,
  // expired/missing = problem, waived/not_shared = neutral.
  if (category === 'eval_status') {
    if (v === 'met') return 'success';
    if (v === 'claimed' || v === 'insufficient') return 'warn';
    if (v === 'expired' || v === 'missing') return 'problem';
    if (v === 'waived' || v === 'not_shared') return 'neutral';
  }
  // Entity Approvals approval_status tones: pending = warn, approved = success, revoked = problem.
  if (category === 'approval_status') {
    if (v === 'pending') return 'warn';
    if (v === 'approved') return 'success';
    if (v === 'revoked') return 'problem';
  }
  // v1.44 pd_verdict tones: on-time = green, marginal = amber, wall/infeasible = red
  if (category === 'pd_verdict') {
    if (v === 'on-time') return 'success';
    if (v === 'marginal') return 'warn';
    if (v === 'wall' || v === 'infeasible') return 'problem';
  }
  // P5 readiness outcome tones (spec §6.2): available = green, four risk
  // outcomes = amber, hard_gap = red. No orange (nav-only per brand rules).
  if (category === 'readiness') {
    if (v === 'available') return 'success';
    if (['quantity_short', 'shade_risk', 'length_gap', 'lead_time_shift'].includes(v)) return 'warn';
    if (v === 'hard_gap') return 'problem';
  }
  return 'neutral';
}

export function Pill({
  category,
  value,
  detail,
  definition,
  tone,
  className = '',
  children,
}: PillProps) {
  const tipId = useId();
  const [open, setOpen] = useState(false);

  const resolved =
    definition ?? (category && value ? PILL_DEFINITIONS[category]?.[value] : undefined);

  if (process.env.NODE_ENV !== 'production' && !resolved) {
    const warnKey = `${category}:${value}`;
    if (!_warnedKeys.has(warnKey)) {
      _warnedKeys.add(warnKey);
      console.warn('[Pill] no definition resolved', { category, value });
    }
  }

  const body = [resolved ?? '', detail ? `Reason: ${detail}` : '']
    .filter(Boolean)
    .join('\n');

  const appliedTone = TONE_CLASS[tone ?? deriveTone(category, value)];
  const label = children ?? (value ? TITLE_CASE(value) : null);

  return (
    <span
      data-testid="pill"
      tabIndex={0}
      aria-describedby={body ? tipId : undefined}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      // If tooltip content ever becomes interactive (links/buttons), replace this
      // with a relatedTarget containment check so focus moving into the tooltip
      // doesn't dismiss it.
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false);
      }}
      onClick={() => setOpen((o) => !o)}
      className={`relative inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-default ${appliedTone} ${className}`}
    >
      {label}
      {body && open && (
        <span
          role="tooltip"
          id={tipId}
          className="absolute left-0 top-full z-50 mt-1 w-max max-w-xs whitespace-pre-line rounded bg-navy px-2 py-1 text-xs font-normal text-white shadow-lg"
        >
          {body}
        </span>
      )}
      {body && !open && (
        <span id={tipId} className="sr-only">
          {body}
        </span>
      )}
    </span>
  );
}
