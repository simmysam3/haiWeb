'use client';

import { useState, type ReactNode } from 'react';
import { DetailChevron } from '@/components/sonar/observations';

interface Props {
  /** Total watcher configurations. */
  count: number;
  /** Configurations with a recurring cadence (not manual_only). */
  scheduledCount: number;
  children: ReactNode;
}

/**
 * Collapsed-by-default wrapper for the watcher Configurations table. The runs
 * list below is the primary artifact of the page; configurations are setup
 * state, so they stay folded behind a one-line summary until asked for.
 */
export function ConfigurationsAccordion({ count, scheduledCount, children }: Props) {
  const [expanded, setExpanded] = useState(false);

  const summary = `${count} configuration${count === 1 ? '' : 's'} · ${scheduledCount} scheduled`;

  return (
    // Full-width white card so the folded configurations keep a slight
    // highlighted presence against the page background instead of reading
    // as a stray line of text.
    <section
      aria-labelledby="watcher-configs-heading"
      className="rounded-lg border border-slate/20 bg-white"
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className="group flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <h2
          id="watcher-configs-heading"
          className="font-[family-name:var(--font-display)] text-base font-bold text-navy"
        >
          Configurations
        </h2>
        <span className="text-sm text-slate">{summary}</span>
        <span className="ml-auto">
          <DetailChevron expanded={expanded} />
        </span>
      </button>
      {expanded && (
        <div className="border-t border-slate/10 px-4 pb-4 pt-3">{children}</div>
      )}
    </section>
  );
}
