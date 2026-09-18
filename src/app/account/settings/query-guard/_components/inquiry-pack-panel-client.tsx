'use client';

import { useState } from 'react';
import { InquiryPackPanel } from './inquiry-pack-panel';
import type { InquiryPackConfig, InquiryPackName } from '@/lib/safe-room-types';

/**
 * Owns the PUT call for the inquiry-door pack (the shape of GuardRulesMatrix.save(),
 * guard-rules-matrix.tsx:134-164): InquiryPackPanel itself is a controlled component so it can
 * be unit-tested with a plain onSave spy, and this wrapper is the one place that talks to the
 * BFF route.
 */
export function InquiryPackPanelClient({ initialPack }: { initialPack: InquiryPackConfig }) {
  const [pack, setPack] = useState(initialPack);

  async function handleSave(next: InquiryPackName) {
    const res = await fetch('/api/account/query-guard/pack', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pack: next }),
    });
    if (res.ok) {
      const payload = (await res.json()) as InquiryPackConfig;
      setPack(payload);
    }
  }

  return <InquiryPackPanel current={pack} onSave={handleSave} />;
}
