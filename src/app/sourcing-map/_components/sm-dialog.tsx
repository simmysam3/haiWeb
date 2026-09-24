'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusablesIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

/** App-themed modal (the console Modal is white-on-light; the app is dark by default). */
export function SmDialog({ title, open, onClose, children, footer }: {
  title: string; open: boolean; onClose(): void; children: ReactNode; footer?: ReactNode;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // WCAG 2.1 AA (AC 2): move focus into the dialog on open, trap Tab/Shift+Tab
  // while it's open, and return focus to whatever had it before opening.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const first = dialog ? focusablesIn(dialog)[0] : undefined;
    (first ?? dialog)?.focus();
    return () => previouslyFocused.current?.focus();
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onClose();
            return;
          }
          if (e.key !== 'Tab') return;
          const dialog = dialogRef.current;
          const items = dialog ? focusablesIn(dialog) : [];
          if (items.length === 0) {
            e.preventDefault();
            return;
          }
          const first = items[0]!;
          const last = items[items.length - 1]!;
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }}
        className="sm-card relative w-full max-w-lg p-6"
      >
        <h2 id={titleId} className="sm-heading text-lg font-semibold">{title}</h2>
        <div className="mt-4">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
