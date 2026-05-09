'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ManualTriggerButton({
  templateId,
  enabled,
}: {
  templateId: string;
  enabled: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function trigger() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/account/sonar/templates/${templateId}/trigger`,
        { method: 'POST' },
      );
      if (!res.ok) {
        setError(`Trigger failed (${res.status})`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
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
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </div>
  );
}
