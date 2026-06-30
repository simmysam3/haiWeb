'use client';

import { Pill } from '@/components/pill';
import type { RolledUpReadinessState } from '@haiwave/protocol';

type RollupColorway = {
  sku_ref: string;
  colorway_name: string;
  rolled_up_state: RolledUpReadinessState;
};

type RollupGridProps = {
  colorways: RollupColorway[];
};

export function RollupGrid({ colorways }: RollupGridProps) {
  return (
    <div className="rounded-md border border-slate/20 bg-white overflow-hidden">
      {colorways.map((c) => (
        <div
          key={c.sku_ref}
          className="flex items-center justify-between px-4 py-3 border-b border-slate/10 last:border-0"
        >
          <span className="text-sm font-medium text-charcoal">{c.colorway_name}</span>
          <Pill category="readiness_rollup" value={c.rolled_up_state} />
        </div>
      ))}
    </div>
  );
}
