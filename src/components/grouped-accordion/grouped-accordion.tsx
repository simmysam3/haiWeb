'use client';

import type { ReactNode } from 'react';

interface Props {
  expanded: Set<string>;
  onToggle: (key: string) => void;
  initialExpanded?: 'all' | 'none';
  children: ReactNode;
}

/**
 * Shared class-grouped accordion shell. The outer container.
 * Visual contract carried verbatim from the v.1.41 audit-wizard accordion
 * (`audit-bilateral-scope-fields.tsx` commit 1440312). Extracted so wizard,
 * provenance, and future consumers stay in sync.
 *
 * `expanded` + `onToggle` are owned by the caller; this component is
 * presentational (it doesn't store state). `initialExpanded` is hint
 * metadata for callers managing default state — the component itself just
 * renders whatever children it's given.
 *
 * Children should be <AccordionGroupRow> instances; the component does not
 * enforce that at the type level (any ReactNode is allowed) so that callers
 * can wrap rows in fragments, conditional renders, etc.
 */
export function GroupedAccordion({ children }: Props) {
  return (
    <div role="tree" className="space-y-1 rounded border border-slate/20 bg-white">
      {children}
    </div>
  );
}
