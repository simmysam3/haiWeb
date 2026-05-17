import type { PhantomDemandResult } from '@/lib/haiwave-api';

export type ProbeVerdict = 'full' | 'partial' | 'declined' | 'no_answer' | 'unusable';

export interface ProbeAsk {
  hypothetical_quantity: number;
  hypothetical_timeline: string | null;
}

export interface InterpretedProbeResult {
  verdict: ProbeVerdict;
  verdictLabel: string;
  tone: 'success' | 'warn' | 'problem' | 'neutral';
  meaning: string;
  confidence: 'high' | 'medium' | 'low' | null;
  quotedQuantity: number | null;
  quotedTimeline: string | null;
  action: string;
}

interface ProbePayload {
  responder_quoted_quantity?: unknown;
  responder_quoted_timeline?: unknown;
  responder_confidence?: unknown;
  responder_completeness?: unknown;
}

const COMPLETENESS = new Set(['complete', 'partial', 'declined']);
const CONFIDENCE = new Set(['high', 'medium', 'low']);

function asConfidence(v: unknown): 'high' | 'medium' | 'low' | null {
  return typeof v === 'string' && CONFIDENCE.has(v) ? (v as 'high' | 'medium' | 'low') : null;
}
function asInt(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
function asTimeline(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}
function fmtBy(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : ` by ${d.toLocaleDateString()}`;
}

/**
 * Single source of truth for "what does this probe result mean". Total: always
 * returns a valid InterpretedProbeResult; never throws. Both the human table
 * and any agent-facing readout derive from this — they must not re-derive
 * meaning independently.
 */
export function interpretProbeResult(
  result: PhantomDemandResult,
  ask: ProbeAsk,
): InterpretedProbeResult {
  // Rule 1: no usable answer (wins over any stale payload).
  if (result.synthesis_mode === 'redacted_gap') {
    const rawReason = (result.gap as { reason?: unknown } | null)?.reason;
    const reason = typeof rawReason === 'string' && rawReason.length > 0 ? rawReason : '';
    return {
      verdict: 'no_answer',
      verdictLabel: 'No answer',
      tone: 'neutral',
      meaning:
        'No usable reply came back from the responder. This is missing data, not a decline — supplier availability is unknown for this SKU.' +
        (reason ? ` (reason: ${reason})` : ''),
      confidence: null,
      quotedQuantity: null,
      quotedTimeline: null,
      action:
        'Not a "no" — re-probe, or verify you have an authorized trading relationship with this counterparty.',
    };
  }

  const payload = (result.payload ?? {}) as ProbePayload;
  const completeness = payload.responder_completeness;

  // Rule 2: responded but uninterpretable.
  if (typeof completeness !== 'string' || !COMPLETENESS.has(completeness)) {
    return {
      verdict: 'unusable',
      verdictLabel: 'Unusable response',
      tone: 'neutral',
      meaning: 'A response arrived but could not be interpreted.',
      confidence: null,
      quotedQuantity: asInt(payload.responder_quoted_quantity),
      quotedTimeline: asTimeline(payload.responder_quoted_timeline),
      action: 'Re-probe. If it persists, flag the responder integration.',
    };
  }

  const confidence = asConfidence(payload.responder_confidence);
  const quotedQuantity = asInt(payload.responder_quoted_quantity);
  const quotedTimeline = asTimeline(payload.responder_quoted_timeline);
  const by = fmtBy(quotedTimeline);

  // Rule 3: declined.
  if (completeness === 'declined') {
    return {
      verdict: 'declined',
      verdictLabel: 'Declined',
      tone: 'problem',
      meaning: 'Supplier indicated it would not fulfill this hypothetical request.',
      confidence,
      quotedQuantity,
      quotedTimeline,
      action: "This supplier won't cover it — seek an alternate source.",
    };
  }

  // Rule 4: partial.
  if (completeness === 'partial') {
    return {
      verdict: 'partial',
      verdictLabel: 'Partial',
      tone: 'warn',
      meaning: `Supplier could cover only part of the hypothetical ask (quoted ${
        quotedQuantity ?? '?'
      } of ${ask.hypothetical_quantity}${by}).`,
      confidence,
      quotedQuantity,
      quotedTimeline,
      action: 'Plan for the shortfall — consider dual-sourcing the remainder.',
    };
  }

  // Rule 5: complete (full).
  return {
    verdict: 'full',
    verdictLabel: 'Can fulfill',
    tone: 'success',
    meaning: `Supplier indicates it can meet the full hypothetical quantity (${ask.hypothetical_quantity}${by}).`,
    confidence,
    quotedQuantity,
    quotedTimeline,
    action:
      confidence === 'high'
        ? 'Strong signal — reasonable to plan around.'
        : 'Treat the quantity as tentative; confirm before committing.',
  };
}
