'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Auto-polls the audit-run BFF while a run is in progress and triggers a
 * server re-render once the status transitions away from `running`. The
 * parent route is a server component, so once it re-renders this placeholder
 * unmounts and is replaced with the appropriate complete/partial/error UI.
 *
 * Behavior:
 *  - Polls every POLL_MS while the tab is visible.
 *  - Skips ticks when the tab is hidden (no point burning bandwidth when the
 *    user isn't looking) and resumes on visibilitychange.
 *  - Aborts in-flight fetches on unmount.
 *  - Network errors are surfaced inline but don't stop polling — transient
 *    blips shouldn't strand the user waiting forever.
 */

const POLL_MS = 5_000;

interface Props {
  runId: string;
}

interface RunDetailLite {
  run?: { status?: string };
}

export function InProgressPoller({ runId }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;

    async function tick(): Promise<void> {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.hidden) {
        schedule();
        return;
      }
      controller = new AbortController();
      try {
        const res = await fetch(`/api/account/sonar/audit/runs/${runId}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (cancelled) return;
        if (!res.ok) throw new Error(`status ${res.status}`);
        const body = (await res.json()) as RunDetailLite;
        if (cancelled) return;
        setError(null);
        const status = body.run?.status;
        if (status && status !== 'running') {
          // Run reached a terminal state — re-render the server route. The
          // parent will replace this poller with the real results UI.
          router.refresh();
          return; // stop polling; the parent unmounts us on refresh
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const name = (err as { name?: string } | null)?.name;
        if (name === 'AbortError') return;
        setError(err instanceof Error ? err.message : String(err));
      }
      schedule();
    }

    function schedule() {
      if (cancelled) return;
      timer = setTimeout(tick, POLL_MS);
    }

    function onVisibilityChange() {
      // When the tab becomes visible again, poll immediately rather than
      // waiting out the remainder of the current interval.
      if (!cancelled && !document.hidden) {
        if (timer) clearTimeout(timer);
        tick();
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    tick(); // first poll immediately on mount

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      controller?.abort();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [runId, router]);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="audit-run-in-progress"
      className="rounded-lg border border-teal/20 bg-teal/5 px-5 py-8 text-center text-sm text-teal"
    >
      <div className="flex items-center justify-center gap-2">
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal/70 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-teal" />
        </span>
        <p className="font-medium">Run in progress…</p>
      </div>
      <p className="mt-2 text-xs text-teal/80">
        This page will update automatically when the run completes.
      </p>
      {error && (
        <p className="mt-2 text-xs text-problem">
          Couldn&apos;t reach the monitoring service ({error}). Use Refresh
          above to try again.
        </p>
      )}
    </div>
  );
}
