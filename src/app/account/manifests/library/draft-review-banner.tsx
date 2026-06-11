'use client';

import { useState } from 'react';

interface DraftReviewBannerProps {
  draftIds: string[];
  onChanged: () => void;
}

/**
 * DraftReviewBanner — amber callout shown above the library matrix when
 * auto-gathered draft items are awaiting review, with a bulk "Accept all".
 */
export function DraftReviewBanner({ draftIds, onChanged }: DraftReviewBannerProps) {
  const [busy, setBusy] = useState(false);
  if (draftIds.length === 0) return null;

  async function acceptAll() {
    if (busy) return;
    setBusy(true);
    try {
      await Promise.allSettled(
        draftIds.map((id) =>
          fetch(`/api/account/library/items/${encodeURIComponent(id)}/affirm`, {
            method: 'POST',
          }),
        ),
      );
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md bg-amber-50 border border-amber-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-amber-900">
          <span className="font-medium">Review your gathered library</span> — {draftIds.length}{' '}
          gathered item(s) awaiting review. Accept or reject each item below, or accept everything
          at once.
        </p>
        <button
          type="button"
          onClick={acceptAll}
          disabled={busy}
          className="shrink-0 rounded border border-teal px-3 py-1 text-sm text-teal hover:bg-teal/10 disabled:opacity-50"
        >
          {busy ? 'Accepting…' : 'Accept all'}
        </button>
      </div>
    </div>
  );
}
