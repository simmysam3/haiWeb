import type { ReactNode } from 'react';

interface SpotCheckTooltipProps {
  children: ReactNode;
}

/** Wrap a single cell value (LT, inventory qty) with a "non-binding spot check" tooltip. */
export function SpotCheckTooltip({ children }: SpotCheckTooltipProps) {
  return (
    <span
      className="underline decoration-dotted decoration-slate-400 underline-offset-4"
      title="Spot check — non-binding. Submit a quote request to commit."
    >
      {children}
    </span>
  );
}
