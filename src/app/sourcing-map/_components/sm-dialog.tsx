'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The real Tab sequence inside `root`: every focusable element, EXCEPT that a
 * named radio group (`<input type="radio" name="…">`) contributes only one
 * stop — its checked radio, or its first radio if none is checked — because
 * that is the only member a real browser lets Tab land on. Without this, a
 * mid-list checked radio (e.g. "Delete them" in `DispositionDialog`) is not
 * `items[0]` or `items[items.length - 1]`, so Tab/Shift+Tab from it never
 * gets intercepted and focus escapes the modal.
 */
function focusablesIn(root: HTMLElement): HTMLElement[] {
  const all = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  const seenRadioGroups = new Set<string>();
  const items: HTMLElement[] = [];
  for (const el of all) {
    if (el instanceof HTMLInputElement && el.type === 'radio' && el.name) {
      if (seenRadioGroups.has(el.name)) continue;
      seenRadioGroups.add(el.name);
      const group = all.filter(
        (e): e is HTMLInputElement => e instanceof HTMLInputElement && e.type === 'radio' && e.name === el.name,
      );
      items.push(group.find((r) => r.checked) ?? group[0]!);
      continue;
    }
    items.push(el);
  }
  return items;
}

/**
 * Complete literal class sets (Tailwind v4). `wide` is the upload wizard's: a
 * wider panel whose overlay scrolls a tall column table instead of clipping it,
 * under a dim fixed to the viewport.
 */
const LAYOUT = {
  normal: {
    overlay: 'fixed inset-0 z-50 flex items-center justify-center p-4',
    backdrop: 'absolute inset-0 bg-black/60',
    panel: 'sm-card relative w-full max-w-lg p-6',
  },
  wide: {
    overlay: 'fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-6',
    backdrop: 'fixed inset-0 bg-black/60',
    panel: 'sm-card relative w-full max-w-5xl p-6',
  },
} as const;

/** App-themed modal (the console Modal is white-on-light; the app is dark by default). */
export function SmDialog({ title, open, onClose, children, footer, wide = false }: {
  title: string; open: boolean; onClose(): void; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  const layout = wide ? LAYOUT.wide : LAYOUT.normal;
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
    <div className={layout.overlay}>
      <div className={layout.backdrop} onClick={onClose} aria-hidden="true" />
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
        className={layout.panel}
      >
        <h2 id={titleId} className="sm-heading text-lg font-semibold">{title}</h2>
        <div className="mt-4">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
