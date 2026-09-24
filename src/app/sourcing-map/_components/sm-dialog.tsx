'use client';
import { useId, type ReactNode } from 'react';

/** App-themed modal (the console Modal is white-on-light; the app is dark by default). */
export function SmDialog({ title, open, onClose, children, footer }: {
  title: string; open: boolean; onClose(): void; children: ReactNode; footer?: ReactNode;
}) {
  const titleId = useId();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
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
