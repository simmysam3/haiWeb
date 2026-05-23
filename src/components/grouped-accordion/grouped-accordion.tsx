'use client';

import type { ReactNode } from 'react';

interface Props {
  /**
   * Hint metadata for callers managing default state — not consumed by
   * this component. Documents the intended pattern: 'all' = render all
   * groups expanded; 'none' = collapsed by default. Callers seed their
   * own expanded Set accordingly.
   */
  initialExpanded?: 'all' | 'none';
  children: ReactNode;
}

/**
 * Shared class-grouped accordion shell. The outer container.
 * Visual contract carried verbatim from the v.1.41 audit-wizard accordion
 * (`audit-bilateral-scope-fields.tsx` commit 1440312). Extracted so wizard,
 * provenance, and future consumers stay in sync.
 *
 * This component is intentionally presentational — it owns no state and
 * does not coordinate expansion. Callers manage their own `expanded: Set`
 * and `onToggle` handler, passing them to individual <AccordionGroupRow>
 * children. This keeps the shell composable: nested accordions, picker
 * variants with checkboxes, browse variants without — all just wrap
 * AccordionGroupRow children.
 */
export function GroupedAccordion({ children }: Props) {
  return (
    <div role="tree" className="space-y-1 rounded border border-slate/20 bg-white">
      {children}
    </div>
  );
}
