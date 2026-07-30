'use client';
import { useId, useState, type ReactNode } from 'react';

// Shared definition-tooltip behaviour: hover/focus/click to open, Escape to
// dismiss, aria-describedby wiring, and an sr-only fallback so the text is
// reachable while the visual tooltip is closed. Extracted from <Pill> so
// <ColumnHeader> can carry the same definitions without pill chrome.

interface DefinitionTipProps {
  /** Fully composed tooltip text. Empty string renders children with no tooltip. */
  body: string;
  /**
   * ALL appearance and positioning classes come from the caller — this component
   * adds none, so <Pill>'s rendered class string is unchanged by the extraction.
   * Must include `relative`: the tooltip is absolutely positioned against it.
   */
  className?: string;
  testId?: string;
  children: ReactNode;
}

export function DefinitionTip({ body, className = '', testId, children }: DefinitionTipProps) {
  const tipId = useId();
  const [open, setOpen] = useState(false);

  return (
    <span
      data-testid={testId}
      tabIndex={0}
      aria-describedby={body ? tipId : undefined}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      // If tooltip content ever becomes interactive (links/buttons), replace this
      // with a relatedTarget containment check so focus moving into the tooltip
      // doesn't dismiss it.
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false);
      }}
      onClick={() => setOpen((o) => !o)}
      className={className}
    >
      {children}
      {body && open && (
        <span
          role="tooltip"
          id={tipId}
          className="absolute left-0 top-full z-50 mt-1 w-max max-w-xs whitespace-pre-line rounded bg-navy px-2 py-1 text-xs font-normal text-white shadow-lg"
        >
          {body}
        </span>
      )}
      {body && !open && (
        <span id={tipId} className="sr-only">
          {body}
        </span>
      )}
    </span>
  );
}
