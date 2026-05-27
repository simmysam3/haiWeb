'use client';
import type { ReactNode } from 'react';
import { Pill } from '@/components';

export function StepCard({
  id,
  index,
  title,
  locked = false,
  dim = false,
  accent,
  unnumbered = false,
  children,
}: {
  id: string;
  index: number;
  title: string;
  locked?: boolean;
  dim?: boolean;
  /** Optional accent tint applied to the card border and step badge.
   *  Currently only 'orange' is supported. Ignored when `locked` is true. */
  accent?: 'orange';
  /**
   * v.1.42 — when true, suppresses the leading numeric badge (and the
   * "Fixed at creation" pill associated with `locked`). Used for the
   * History step, which sits at the bottom of the rail as a read-only
   * audit trail rather than a numbered configuration step.
   */
  unnumbered?: boolean;
  children: ReactNode;
}) {
  const accentOrange = !locked && accent === 'orange';
  return (
    <section
      id={`step-${id}`}
      className={[
        'scroll-mt-6 rounded-xl p-5 mb-3',
        locked
          ? 'bg-slate/5 border border-dashed border-slate/25'
          : accentOrange
            ? 'bg-white border border-orange/30'
            : 'bg-white border border-slate/15',
        dim && 'opacity-50',
      ].filter(Boolean).join(' ')}
    >
      <div className="flex items-center gap-2 mb-4">
        {!unnumbered && (
          <span
            aria-hidden
            className={[
              'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-none',
              locked
                ? 'bg-slate/20 text-slate'
                : accentOrange
                  ? 'bg-orange/20 text-orange'
                  : 'bg-teal/20 text-teal',
            ].join(' ')}
          >
            {locked ? '\u{1F512}' : index + 1}
          </span>
        )}
        <h2 className="text-sm font-semibold text-charcoal font-[family-name:var(--font-display)]">
          {title}
        </h2>
        {locked && !unnumbered && (
          <span className="ml-auto">
            <Pill category="config_provenance" value="fixed_at_creation">Fixed at creation</Pill>
          </span>
        )}
      </div>
      {children}
    </section>
  );
}
