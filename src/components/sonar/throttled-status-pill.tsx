'use client';
import { useEffect, useState } from 'react';

interface Props {
  nextResumeAt: string; // ISO datetime
}

/**
 * ThrottledStatusPill — renders a live-updating countdown until the run
 * resumes after a budget throttle. Refreshes every 30 seconds.
 *
 * v1.29 Phase 1.
 */
export function ThrottledStatusPill({ nextResumeAt }: Props) {
  const [countdown, setCountdown] = useState(() => formatCountdown(nextResumeAt));
  useEffect(() => {
    const id = setInterval(() => setCountdown(formatCountdown(nextResumeAt)), 30_000);
    return () => clearInterval(id);
  }, [nextResumeAt]);
  return (
    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-amber-50 text-amber-900 border border-amber-200">
      Throttled · Resumes in {countdown}
    </span>
  );
}

function formatCountdown(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'imminently';
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
