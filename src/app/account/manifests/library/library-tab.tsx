'use client';

import useSWR from 'swr';
import { useState } from 'react';
import type { LibraryView, LibraryElement, PolicyContext } from '@/lib/library-types';
import { LibraryMatrix } from './library-matrix';
import { AddEvidenceModal } from './add-evidence-modal';
import { DraftReviewBanner } from './draft-review-banner';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function collectDraftIds(view: LibraryView): string[] {
  return view.sections.flatMap((s) =>
    s.elements.flatMap((el) => [
      ...el.artifacts.filter((a) => a.status === 'draft').map((a) => a.id),
      ...(el.attribute?.status === 'draft' ? [el.attribute.id] : []),
    ]),
  );
}

export function LibraryTab({ context }: { context: PolicyContext }) {
  const { data, mutate, isLoading, error } = useSWR<LibraryView>('/api/account/library', fetcher);
  const [modalElement, setModalElement] = useState<LibraryElement | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [gatherStarted, setGatherStarted] = useState(false);
  if (error) return <p className="text-sm text-problem">Couldn&apos;t load the library — refresh to retry.</p>;
  if (isLoading || !data) return <p className="text-sm text-slate">Loading library…</p>;

  const draftIds = collectDraftIds(data);

  async function handleDraftAction(itemId: string, action: 'affirm' | 'reject') {
    try {
      const res = await fetch(
        `/api/account/library/items/${encodeURIComponent(itemId)}/${action}`,
        { method: 'POST' },
      );
      if (res.ok) {
        setActionError(null);
      } else if (res.status === 404) {
        setActionError('That item was already reviewed.');
      } else {
        setActionError(
          `Couldn't ${action === 'affirm' ? 'accept' : 'reject'} that item — try again.`,
        );
      }
      // Revalidate on failure too, so a stale draft row snaps back to truth
      // (e.g. a 404 because the item was already reviewed elsewhere).
      mutate();
    } catch {
      setActionError(
        `Couldn't ${action === 'affirm' ? 'accept' : 'reject'} that item — try again.`,
      );
    }
  }

  async function startGather() {
    try {
      const res = await fetch('/api/account/library/gather', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.status === 202) {
        setActionError(null);
        setGatherStarted(true);
      } else if (res.status === 422) {
        setActionError('No website URL on record for your company.');
      } else {
        setActionError("Couldn't start the gather — try again.");
      }
    } catch {
      setActionError("Couldn't start the gather — try again.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate">
          {context === 'share'
            ? 'Sell side — the documents and business terms your company holds, kept in this one place for the parties who buy from you. Agents reconcile buyers’ requirements against this library automatically. Each item is wrapped in a permission level: click a cell to set which class of counterparty (Qualified through Premier) must be in place before that item is shared.'
            : 'Buy side — what you require of the parties you buy from, at each trust tier. Each supplier satisfies these from their own library, so the evidence differs supplier to supplier; your documents play no part here. Click a cell to toggle a requirement.'}
        </p>
        {/* Gather pulls OUR website's policy docs — only meaningful for the
            sell-side library, never for buy-side requirements on suppliers. */}
        {context === 'share' && (
          <button
            type="button"
            onClick={startGather}
            disabled={gatherStarted}
            className="text-xs text-teal underline hover:text-navy disabled:text-slate disabled:no-underline"
          >
            {gatherStarted ? 'Gather started — drafts will appear shortly' : 'Gather from website'}
          </button>
        )}
      </div>
      {actionError && (
        <p role="alert" className="text-sm text-problem">
          {actionError}
        </p>
      )}
      <DraftReviewBanner draftIds={draftIds} onChanged={() => mutate()} />
      <LibraryMatrix
        view={data}
        context={context}
        readOnly={false}
        onChanged={() => mutate()}
        onAddEvidence={setModalElement}
        onDraftAction={handleDraftAction}
      />
      <AddEvidenceModal
        element={modalElement}
        onClose={() => setModalElement(null)}
        onSaved={() => mutate()}
      />
    </div>
  );
}
