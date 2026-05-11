'use client';

import { useEffect, useState } from 'react';
import type { ObservationClass } from '@haiwave/protocol';

const COPY: Record<ObservationClass, string> = {
  audit:
    'Compliance and regulatory observation. Verify origin, certifications, and source authenticity through the supply chain.',
  watcher:
    'Continuous monitoring of your established trading partners. Track lead times, capacity, fulfillment, and delivery patterns over time.',
  phantom_demand:
    'Procurement questions. Ask trading partners "if I needed N units of X, when could you deliver?" without committing to an order.',
};

export function HelperBanner({ modality }: { modality: ObservationClass }) {
  const key = `haiwave.observations.banner.${modality}.dismissed`;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage.getItem(key) === 'true') {
      setDismissed(true);
    }
  }, [key]);

  if (dismissed) return null;

  return (
    <div className="bg-teal/10 border border-teal/30 rounded p-3 text-sm text-charcoal flex items-start gap-3">
      <span className="flex-1">{COPY[modality]}</span>
      <button
        onClick={() => {
          window.localStorage.setItem(key, 'true');
          setDismissed(true);
        }}
        className="text-slate hover:text-charcoal"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
