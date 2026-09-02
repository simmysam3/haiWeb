'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

export interface ActionsMenuItem {
  label: string;
  href: string;
}

interface Props {
  /** Accessible name for the trigger and the menu, e.g. "Actions for Acme". */
  label: string;
  items: ActionsMenuItem[];
  /** Visible trigger text. Defaults to "Actions". */
  buttonText?: string;
}

/**
 * v1.85 — a row-level actions menu: one labelled button that opens a
 * WAI-ARIA menu of links. Used where a single un-labelled drill-down could
 * not say where it led (the watcher Configurations table: runs or config?).
 *
 * Behaviour: click toggles; opening moves focus to the first item; Up/Down
 * move focus and wrap; Escape closes and returns focus to the trigger;
 * a pointer-down outside closes. Items are plain links so they work with
 * middle-click and keyboard activation without extra wiring.
 */
export function ActionsMenu({ label, items, buttonText = 'Actions' }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);

  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  function onMenuKeyDown(e: KeyboardEvent<HTMLUListElement>) {
    const focused = itemRefs.current.findIndex((el) => el === document.activeElement);
    let next: number | null = null;
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        close(true);
        return;
      case 'Tab':
        close(false);
        return;
      case 'ArrowDown':
        next = (focused + 1) % items.length;
        break;
      case 'ArrowUp':
        next = (focused - 1 + items.length) % items.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = items.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    itemRefs.current[next]?.focus();
  }

  return (
    <div ref={rootRef} className="relative inline-block text-left">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded border border-slate/20 bg-white px-2.5 py-1 text-xs font-medium text-charcoal hover:border-teal hover:text-teal"
      >
        {buttonText}
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          className="h-3 w-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 4.5l3 3 3-3" />
        </svg>
      </button>
      {open && (
        <ul
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 z-20 mt-1 min-w-[11rem] rounded-md border border-slate/15 bg-white py-1 shadow-lg"
        >
          {items.map((item, i) => (
            <li key={item.href} role="none">
              <Link
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                role="menuitem"
                href={item.href}
                tabIndex={-1}
                onClick={() => setOpen(false)}
                className="block px-3 py-1.5 text-sm text-charcoal hover:bg-slate-50 hover:text-teal focus:bg-slate-50 focus:text-teal focus:outline-none"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
