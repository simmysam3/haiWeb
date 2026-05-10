'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface CancelButtonProps {
  runId: string;
}

export function CancelButton({ runId }: CancelButtonProps) {
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleCancel() {
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/account/sonar/phantom-demand/runs/${runId}/cancel`,
        { method: 'POST', credentials: 'include' },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Cancel failed: ${res.status}`);
      }
      // Refresh server data after a brief delay so the status update propagates
      setTimeout(() => {
        router.refresh();
      }, 500);
    } catch (err) {
      setCancelling(false);
      setError(err instanceof Error ? err.message : 'Cancel failed');
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleCancel}
        disabled={cancelling}
        className="text-sm px-3 py-1 rounded border border-slate/20 text-charcoal hover:bg-light-gray transition-colors disabled:opacity-60"
      >
        {cancelling ? 'Cancelling…' : 'Cancel run'}
      </button>
      {error && <span className="text-xs text-problem">{error}</span>}
    </div>
  );
}
