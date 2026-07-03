import type { TrustClass } from '@haiwave/protocol';

export const TRUST_CLASS_LABEL: Record<TrustClass, string> = {
  unknown: 'Unknown',
  behavioral_only: 'Behavioral-only',
  trading_pair: 'Trading pair',
  premier_partner: 'Premier partner',
};
