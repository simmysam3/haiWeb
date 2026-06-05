'use client';

import type { ReactNode } from 'react';
import { DetailChevron } from '@/components/sonar/observations';

export type CountValue = number | { filtered: number; total: number } | string;

interface Props {
  groupKey: string;
  label: ReactNode;
  count: CountValue;
  controlSlot?: ReactNode;
  extraSlot?: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}

function renderCount(count: CountValue): string {
  if (typeof count === 'number') return String(count);
  if (typeof count === 'string') return count;
  return `${count.filtered} of ${count.total}`;
}

/**
 * One row in a GroupedAccordion. Composes: chevron toggle, optional control
 * slot (e.g. <TristateCheckbox>), label, optional extra slot, right-aligned
 * count chip. Children render only when `expanded`.
 *
 * For ARIA, the chevron button carries aria-expanded + aria-controls; the
 * row itself is role="treeitem" with aria-expanded. The body is role="group"
 * with an id that aria-controls references.
 */
export function AccordionGroupRow({
  groupKey,
  label,
  count,
  controlSlot,
  extraSlot,
  expanded,
  onToggle,
  children,
}: Props) {
  const labelText = typeof label === 'string' ? label : groupKey;
  const bodyId = `${groupKey}-body`;
  return (
    <div role="treeitem" aria-expanded={expanded} className="border-b border-slate/10 last:border-b-0">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <button
          type="button"
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${labelText}`}
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={onToggle}
          className="group inline-flex shrink-0 items-center"
        >
          <DetailChevron expanded={expanded} />
        </button>
        {controlSlot}
        <span className="text-sm text-charcoal truncate">{label}</span>
        {extraSlot}
        <span className="ml-auto text-xs text-slate whitespace-nowrap">
          {renderCount(count)}
        </span>
      </div>
      {expanded && (
        <div id={bodyId} role="group" className="pl-7 pb-1.5">
          {children}
        </div>
      )}
    </div>
  );
}
