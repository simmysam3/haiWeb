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
  signal_type: {
    lead_time_distribution: 'p50 / p75 / p90 / p95 / p99 fulfilment lead time over the last 90 days.',
    capacity_utilization_band: 'Latest reported production band: low, moderate, high, or at_capacity.',
    delivery_event: 'Most recent shipment status — dispatched, in transit, delayed, delivered, or exception. Premier-tier counterparties only.',
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
  if (['complete', 'completed', 'active', 'approved', 'paid', 'online', 'pass', 'compliant', 'trading_pair', 'accepted', 'normal', 'verified'].includes(v)) return 'success';
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
