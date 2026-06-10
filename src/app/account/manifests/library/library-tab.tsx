'use client';

import useSWR from 'swr';
import { useState } from 'react';
import type { LibraryView, LibraryElement, PolicyContext } from '@/lib/library-types';
import { LibraryMatrix } from './library-matrix';
import { AddEvidenceModal } from './add-evidence-modal';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function LibraryTab({ context }: { context: PolicyContext }) {
  const { data, mutate, isLoading } = useSWR<LibraryView>('/api/account/library', fetcher);
  const [modalElement, setModalElement] = useState<LibraryElement | null>(null);
  if (isLoading || !data) return <p className="text-sm text-slate">Loading library…</p>;
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate">
        {context === 'share'
          ? 'Click a cell to share that element with counterparties at that trust tier.'
          : 'Click a cell to require that element of counterparties at that trust tier.'}
      </p>
      <LibraryMatrix
        view={data}
        context={context}
        readOnly={false}
        onChanged={() => mutate()}
        onAddEvidence={setModalElement}
      />
      <AddEvidenceModal
        element={modalElement}
        onClose={() => setModalElement(null)}
        onSaved={() => mutate()}
      />
    </div>
  );
}
