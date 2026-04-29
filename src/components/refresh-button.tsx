'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function RefreshButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        router.refresh();
        // Reset busy after a tick — refresh is fire-and-forget.
        setTimeout(() => setBusy(false), 600);
      }}
      className="rounded-md border border-slate/30 px-3 py-1.5 text-sm text-slate hover:bg-light-gray/40 disabled:opacity-50"
    >
      {busy ? 'Refreshing…' : 'Refresh'}
    </button>
  );
}
