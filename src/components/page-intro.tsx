import type { ReactNode } from 'react';

interface PageIntroProps {
  children: ReactNode;
  /**
   * Optional extended help, revealed by a "Show more" disclosure under the
   * one-line summary. Use when first-time users need a deeper explanation
   * of what to do on the page, not just what the page is.
   */
  more?: ReactNode;
}

export function PageIntro({ children, more }: PageIntroProps) {
  if (!more) {
    return (
      <p className="italic text-slate text-sm leading-relaxed max-w-3xl mb-6 -mt-2">
        {children}
      </p>
    );
  }
  return (
    <div className="max-w-3xl mb-6 -mt-2">
      <p className="italic text-slate text-sm leading-relaxed">{children}</p>
      <details className="mt-2 text-sm text-slate group">
        <summary className="cursor-pointer list-none text-teal hover:underline">
          <span className="inline-block group-open:hidden">Show more ▾</span>
          <span className="hidden group-open:inline">Show less ▴</span>
        </summary>
        <div className="mt-3 space-y-3 leading-relaxed">{more}</div>
      </details>
    </div>
  );
}
