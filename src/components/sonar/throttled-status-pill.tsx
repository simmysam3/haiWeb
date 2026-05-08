'use client';
import { useEffect, useState } from 'react';

interface Props {
  nextResumeAt: string; // ISO datetime
}

/**
 * ThrottledStatusPill — renders a countdown until the run resumes after a
 * budget throttle. Recomputes the displayed minutes every 30s against the
 * current wall clock, but does NOT re-fetch the underlying nextResumeAt — if
 * the parent surface wants the resume time itself to refresh (e.g. because
 * the run completed or its budget window shifted), the parent must re-render
 * with a new prop. On a static page-load this means the pill counts down
 * toward whatever `nextResumeAt` was at server-render time. See run detail
 * page (page.tsx) for the Phase 1 refresh model: the page itself has no
 * client polling, so an operator who leaves the tab open will eventually see
 * "Resuming now" indefinitely until they reload.
 *
 * v1.29 Phase 1.
 */
export function ThrottledStatusPill({ nextResumeAt }: Props) {
  const [countdown, setCountdown] = useState(() => formatCountdown(nextResumeAt));
  useEffect(() => {
    const id = setInterval(() => setCountdown(formatCountdown(nextResumeAt)), 30_000);
    return () => clearInterval(id);
  }, [nextResumeAt]);
  const ready = countdown === null;
  return (
    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-amber-50 text-amber-900 border border-amber-200">
      {ready ? 'Throttled · Resuming now' : `Throttled · Resumes in ${countdown}`}
    </span>
  );
}

function formatCountdown(iso: string): string | null {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
