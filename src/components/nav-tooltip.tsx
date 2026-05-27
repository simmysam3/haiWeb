'use client';

import { useRef, useState, type ReactNode } from 'react';

interface Props {
  text: string;
  /** Hover-time before the tooltip appears, in milliseconds. Default 800. */
  delayMs?: number;
  children: ReactNode;
}

/**
 * Hover-delay tooltip for sidebar nav items. Anchored via
 * getBoundingClientRect at mouseenter and rendered with `position: fixed`
 * so it escapes the sidebar's `overflow-y-auto` clip and appears to the
 * right of the trigger. The 800 ms default delay (per the nav-tooltip
 * design ask) prevents flashes as the cursor passes over rows en route
 * to something else.
 */
export function NavTooltip({ text, delayMs = 800, children }: Props) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function show() {
    clearTimer();
    timerRef.current = setTimeout(() => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPosition({ top: rect.top + rect.height / 2, left: rect.right + 8 });
    }, delayMs);
  }

  function hide() {
    clearTimer();
    setPosition(null);
  }

  return (
    <div
      ref={triggerRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {position && (
        <div
          role="tooltip"
          style={{ top: position.top, left: position.left, transform: 'translateY(-50%)' }}
          className="fixed z-50 max-w-xs whitespace-normal rounded bg-charcoal text-white text-xs leading-snug px-2.5 py-1.5 shadow-lg pointer-events-none"
        >
          {text}
        </div>
      )}
    </div>
  );
}
