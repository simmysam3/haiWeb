'use client';

import { Pill } from '@/components/pill';
import type { ComponentLine } from '@haiwave/protocol';

interface ComponentLineRowProps {
  line: ComponentLine;
}

/**
 * Renders a single colorway component line with its outcome chips.
 * A line may carry multiple outcomes (e.g. both quantity_short and shade_risk
 * on the same leather cell — the double-flag case per spec §5.4 / §10.2).
 */
export function ComponentLineRow({ line }: ComponentLineRowProps) {
  const { component, color_code, length_cm, holding_suppliers, outcomes } = line;

  return (
    <div className="flex items-center justify-between gap-4 py-3 px-4 border-b border-slate/10 last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-16 shrink-0 text-xs font-medium text-navy capitalize">{component}</span>
        <span className="text-sm text-charcoal font-mono">{color_code}</span>
        {length_cm !== null && (
          <span className="text-xs text-slate">{length_cm} cm</span>
        )}
        {holding_suppliers.length > 0 && (
          <span className="text-xs text-slate">
            {holding_suppliers.length} supplier{holding_suppliers.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
        {outcomes.map((outcome) => (
          <Pill key={outcome} category="readiness" value={outcome} />
        ))}
      </div>
    </div>
  );
}
