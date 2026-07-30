import type { SignalType } from '@haiwave/protocol';
import { SIGNAL_TYPE_LABELS } from '@/lib/signal-type-labels';

// soft_quoted_lead_time is the only ask-gated signal: haiCore synthesizes it
// from a phantom-demand traversal for the ask quantity and never probes an
// agent for it. Without a forward-demand ask there is no quantity to resolve
// against, so the signal can be requested but never produced.
export const SOFT_QUOTE_SIGNAL: SignalType = 'soft_quoted_lead_time';

export function requestsSoftQuote(signalTypes: readonly SignalType[]): boolean {
  return signalTypes.includes(SOFT_QUOTE_SIGNAL);
}

// Everything that is not ask-gated is "baseline" — produced whether or not a
// forward-demand ask exists. Derived from the requested set rather than named
// literally, because a watcher that asked for neither published lead time nor
// capacity should not be told those are what it will get.
//
// Returns null when the soft quote was the ONLY signal requested, so callers can
// drop the clause entirely instead of rendering a dangling em-dash pair.
export function describeBaselineSignals(signalTypes: readonly SignalType[]): string | null {
  const labels = signalTypes
    .filter((s) => s !== SOFT_QUOTE_SIGNAL)
    .map((s) => SIGNAL_TYPE_LABELS[s].label.toLowerCase());

  if (labels.length === 0) return null;
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}
