'use client';

import { ReactNode, useEffect } from 'react';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  width?: string;
  children: ReactNode;
}

export function Drawer({
  open,
  onClose,
  title,
  width = 'max-w-lg',
  children,
}: DrawerProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <div
        className="absolute inset-0 bg-navy/40"
        onClick={onClose}
        aria-hidden="true"
        data-testid="drawer-overlay"
      />
      <aside className={`absolute right-0 top-0 h-full w-full ${width} bg-white border-l border-slate/15 shadow-xl flex flex-col`}>
        <header className="flex items-center justify-between border-b border-slate/15 px-6 py-4">
          <h2
            id="drawer-title"
            className="font-[family-name:var(--font-display)] text-lg font-bold text-navy"
          >
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-slate hover:text-charcoal transition-colors text-xl leading-none"
          >
            &times;
          </button>
        </header>
        <div className="flex-1 overflow-auto px-6 py-4">{children}</div>
      </aside>
    </div>
  );
}
