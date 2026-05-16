'use client';
import { useId, useState } from 'react';

// ── Embedded definitions. Edit copy here. (category → value → definition) ──
const PILL_DEFINITIONS: Record<string, Record<string, string>> = {
  run_status: {
    running: 'The run is in progress.',
    complete: 'The run finished and all targets were observed.',
    partial: 'The run finished but some targets could not be observed.',
    failed: 'The run stopped before completing. See the reason for the specific failure.',
    cancelled: 'The run was cancelled by an operator before completing.',
    throttled: 'The run paused because its hop budget was exhausted; it will resume automatically.',
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
    throttled: 'The run paused because its hop budget was exhausted; it resumes automatically on the next tick.',
  },
};

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
  if (['failed', 'fail', 'non_compliant', 'banned', 'suspended', 'past_due', 'disabled', 'critical'].includes(v)) return 'problem';
  if (['pending', 'partial', 'partially_compliant', 'probation', 'open', 'pending_payment', 'elevated', 'throttled'].includes(v)) return 'warn';
  if (['complete', 'completed', 'active', 'approved', 'paid', 'online', 'pass', 'compliant', 'trading_pair', 'accepted', 'normal'].includes(v)) return 'success';
  if (category === 'resolution_class' && v === 'agentic_eligible') return 'info';
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
    console.warn('[Pill] no definition resolved', { category, value });
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
