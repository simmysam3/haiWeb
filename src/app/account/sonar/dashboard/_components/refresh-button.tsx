'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={isPending}
      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-charcoal hover:bg-slate-50 disabled:opacity-50"
      aria-label="Refresh dashboard"
    >
      {isPending ? 'Refreshing…' : 'Refresh'}
    </button>
  );
}
