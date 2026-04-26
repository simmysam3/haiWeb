import type { ReactNode } from 'react';

/**
 * Emphasis panel: solid teal outline + white background. Use for cells that
 * carry slightly more visual weight than a neutral Card — info callouts,
 * dashboard tiles, empty-state CTAs. Replaces ad-hoc bg-layer-1 misuse
 * (layer-1 is a network-layer brand token, not a surface token).
 */
export function Panel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded border border-teal bg-white ${className}`}>
      {children}
    </div>
  );
}
