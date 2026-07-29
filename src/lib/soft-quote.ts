import type { SignalType } from '@haiwave/protocol';

// soft_quoted_lead_time is the only ask-gated signal: haiCore synthesizes it
// from a phantom-demand traversal for the ask quantity and never probes an
// agent for it. Without a forward-demand ask there is no quantity to resolve
// against, so the signal can be requested but never produced.
export const SOFT_QUOTE_SIGNAL: SignalType = 'soft_quoted_lead_time';

export function requestsSoftQuote(signalTypes: readonly SignalType[]): boolean {
  return signalTypes.includes(SOFT_QUOTE_SIGNAL);
}
