'use client';

import type { ReactNode } from 'react';

interface Props {
  controlSlot?: ReactNode;
  label: ReactNode;
  metaSlot: ReactNode;
  onClick?: () => void;
  detailSlot?: ReactNode;
}

/**
 * Leaf row inside an accordion group. With `onClick`, the entire row is a
 * button (clickable; hover affordance). Without, it's a plain div — useful
 * for picker consumers that only care about the controlSlot's checkbox.
 *
 * `metaSlot` is right-aligned via ml-auto. Inside it, place small chips,
 * monospace identifiers, the row-detail affordance (`<DetailChevron />`
 * from components/sonar/observations — never a bare `›`/`→` glyph), etc.
 *
 * `detailSlot` renders on its own line beneath the row, indented under the
 * label. It is a SIBLING of the row element, not a child: detail content
 * routinely carries inputs, and nesting those inside the clickable treeitem
 * would make row activation swallow their clicks.
 * The detail line therefore sits outside the tree's treeitem content model;
 * its inputs are natively focusable, so Tab and browse-mode access are
 * unaffected.
 *
 * The pl-6 inset on both variants keeps the leaf one visual tab deeper than
 * its parent group row's label (whose chevron + checkbox push it right).
 */
export function AccordionLeafRow({ controlSlot, label, metaSlot, onClick, detailSlot }: Props) {
  const labelText = typeof label === 'string' ? label : '';
  const content = (
    <>
      {controlSlot}
      <span className="truncate text-sm text-charcoal">{label}</span>
      <span className="ml-auto flex items-center gap-2">{metaSlot}</span>
    </>
  );
  // Truthy check (not != null): `detailSlot={cond && <X/>}` passes `false`,
  // which must not render an empty padded line.
  const detail = detailSlot ? <div className="pl-12 pr-3 pb-1">{detailSlot}</div> : null;
  if (onClick) {
    return (
      <>
        {/* NOT a <button>: metaSlot routinely carries real buttons (IdChip,
            etc.) and a button-in-button is invalid HTML that React 19 rejects
            with a hydration error. Per the ARIA tree pattern the treeitem node
            itself is the focusable, activatable element. */}
        <div
          role="treeitem"
          aria-level={2}
          aria-label={labelText || undefined}
          tabIndex={0}
          onClick={onClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onClick();
            }
          }}
          // pr-3 keeps the right-aligned chevron / meta from sitting flush
          // against the row's right edge — matches the breathing room of
          // text-right table cells like run-exceptions-panel.tsx.
          className="group flex w-full items-center gap-2 py-0.5 pl-6 pr-3 text-left hover:bg-gray-50 cursor-pointer"
        >
          {content}
        </div>
        {detail}
      </>
    );
  }
  return (
    <>
      <div role="treeitem" aria-level={2} className="flex items-center gap-2 py-0.5 pl-6 pr-3">
        {content}
      </div>
      {detail}
    </>
  );
}
