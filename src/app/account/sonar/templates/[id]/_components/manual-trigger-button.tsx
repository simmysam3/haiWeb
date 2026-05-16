'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { mutate } from 'swr';
import { describeApiError } from '@/lib/api-error';
import { FormError } from '@/components';

type ObservationClass = 'audit' | 'watcher' | 'phantom_demand';

interface ManualTriggerButtonProps {
  templateId: string;
  enabled: boolean;
  observationClass: ObservationClass;
}

interface TriggerSuccess {
  runId: string;
  triggeredAt: string;
}

function runDetailHref(klass: ObservationClass, runId: string): string {
  switch (klass) {
    case 'audit':
      return `/account/sonar/audit/runs/${runId}`;
    case 'phantom_demand':
      return `/account/sonar/phantom-demand/runs/${runId}`;
    case 'watcher':
      // Watcher doesn't have a per-run detail page; land on its dashboard.
      return `/account/sonar/watcher/dashboard`;
  }
}

export function ManualTriggerButton({
  templateId,
  enabled,
  observationClass,
}: ManualTriggerButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [last, setLast] = useState<TriggerSuccess | null>(null);
  const router = useRouter();

  async function trigger() {
    setBusy(true);
    setError(null);
    setSessionExpired(false);
    try {
      const res = await fetch(
        `/api/account/sonar/templates/${templateId}/trigger`,
        { method: 'POST' },
      );
      if (!res.ok) {
        const info = await describeApiError(res);
        setError(info.message);
        setSessionExpired(info.sessionExpired);
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { run_id?: string };
      if (body.run_id) {
        setLast({ runId: body.run_id, triggeredAt: new Date().toISOString() });
      }
      // Force the run-history table to re-fetch immediately so the new row
      // (status='running' / 'pending') shows up without waiting for SWR poll.
      void mutate(`/api/account/sonar/templates/${templateId}/runs`);
      // Refresh the page-level data (last_run_at on the template header).
      router.refresh();
    } catch {
      setError('Network error — could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={trigger}
          disabled={busy || !enabled}
          title={!enabled ? 'Enable the template to trigger a run' : ''}
          className="rounded bg-teal text-white px-3 py-1.5 text-sm font-medium hover:bg-teal/90 disabled:opacity-60"
        >
          {busy ? 'Triggering…' : 'Run now'}
        </button>
      </div>
      {error && <FormError message={error} sessionExpired={sessionExpired} />}
      {last && !error && (
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
            Started
          </span>
          <span className="text-slate">
            run <span className="font-mono">{last.runId.slice(0, 8)}</span> —
          </span>
          <Link
            href={runDetailHref(observationClass, last.runId)}
            className="text-teal hover:underline"
          >
            Open →
          </Link>
        </div>
      )}
    </div>
  );
}
