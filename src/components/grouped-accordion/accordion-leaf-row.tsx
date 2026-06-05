'use client';

import type { ReactNode } from 'react';

interface Props {
  controlSlot?: ReactNode;
  label: ReactNode;
  metaSlot: ReactNode;
  onClick?: () => void;
}

/**
 * Leaf row inside an accordion group. With `onClick`, the entire row is a
 * button (clickable; hover affordance). Without, it's a plain div — useful
 * for picker consumers that only care about the controlSlot's checkbox.
 *
 * `metaSlot` is right-aligned via ml-auto. Inside it, place small chips,
 * monospace identifiers, the row-detail chevron (`›` styled
 * `text-teal text-lg font-bold` per the row-detail style memory), etc.
 */
export function AccordionLeafRow({ controlSlot, label, metaSlot, onClick }: Props) {
  const labelText = typeof label === 'string' ? label : '';
  const content = (
    <>
      {controlSlot}
      <span className="truncate text-charcoal">{label}</span>
      <span className="ml-auto flex items-center gap-2">{metaSlot}</span>
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        role="treeitem"
        aria-level={2}
        aria-label={labelText || undefined}
        onClick={onClick}
        // pr-3 keeps the right-aligned chevron / meta from sitting flush
        // against the row's right edge — matches the breathing room of
        // text-right table cells like run-exceptions-panel.tsx.
        className="group flex w-full items-center gap-2 py-0.5 pr-3 text-left hover:bg-gray-50 cursor-pointer"
      >
        {content}
      </button>
    );
  }
  return (
    <div role="treeitem" aria-level={2} className="flex items-center gap-2 py-0.5 pr-3">
      {content}
    </div>
  );
}
