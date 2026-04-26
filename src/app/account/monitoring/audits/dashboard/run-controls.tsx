'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function RunControls() {
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function runAudit() {
    setError(null);
    startTransition(async () => {
      const res = await fetch('/api/account/audit-runs', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        setError('Run failed — see server logs.');
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-[var(--color-problem)]">{error}</span>}
      <button
        onClick={runAudit}
        disabled={busy}
        className="rounded bg-teal text-white px-3 py-1.5 text-sm font-medium disabled:opacity-60"
      >
        {busy ? 'Running…' : 'Run audit now'}
      </button>
    </div>
  );
}
