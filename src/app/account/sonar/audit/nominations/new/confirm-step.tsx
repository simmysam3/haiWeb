'use client';

import { useState } from 'react';
import type { FormSelections, PartnerSummary } from './types';

interface Props {
  vendor: PartnerSummary;
  selections: FormSelections;
  classLabels: Record<string, string>;
  productLabels: Record<string, string>;
  onSubmitted: () => void;
  onBack: () => void;
}

interface SubmitResult {
  ok: number;
  failed: number;
  totalAttempted: number;
}

export function ConfirmStep({
  vendor,
  selections,
  classLabels,
  productLabels,
  onSubmitted,
  onBack,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);

  async function postScope(body: {
    vendor_participant_id: string;
    scope_type: 'class' | 'product';
    scope_ref: string;
  }) {
    const res = await fetch('/api/account/audit-scopes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok && res.status !== 409) {
      throw new Error(`scope create failed (${res.status})`);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setResult(null);

    const promises: Array<Promise<void>> = [];
    for (const classId of selections.classes) {
      promises.push(postScope({
        vendor_participant_id: vendor.id,
        scope_type: 'class',
        scope_ref: classId,
      }));
    }
    for (const productId of selections.products) {
      promises.push(postScope({
        vendor_participant_id: vendor.id,
        scope_type: 'product',
        scope_ref: productId,
      }));
    }

    const settled = await Promise.allSettled(promises);
    const ok = settled.filter((r) => r.status === 'fulfilled').length;
    const failed = settled.length - ok;
    setSubmitting(false);

    if (failed === 0) {
      onSubmitted();
      return;
    }
    setResult({ ok, failed, totalAttempted: settled.length });
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-slate uppercase tracking-wider mb-1">Vendor</p>
        <p className="text-sm font-medium text-charcoal">{vendor.legal_name}</p>
      </div>

      {selections.classes.size > 0 && (
        <div>
          <p className="text-xs text-slate uppercase tracking-wider mb-1">Classes</p>
          <ul className="border border-slate/20 rounded-lg divide-y divide-slate/10 bg-white">
            {[...selections.classes].map((cid) => (
              <li key={cid} className="px-4 py-2 text-sm text-charcoal">
                {classLabels[cid] ?? cid}
              </li>
            ))}
          </ul>
        </div>
      )}

      {selections.products.size > 0 && (
        <div>
          <p className="text-xs text-slate uppercase tracking-wider mb-1">SKUs</p>
          <ul className="border border-slate/20 rounded-lg divide-y divide-slate/10 bg-white">
            {[...selections.products].map((pid) => (
              <li key={pid} className="px-4 py-2 text-sm text-charcoal">
                {productLabels[pid] ?? pid}
                <span className="ml-2 text-xs text-slate">{pid}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-slate">
        Submitting will create one audit scope per row above. You can disable any of them
        later from the My Nominations list.
      </p>

      {result && result.failed > 0 && (
        <div className="rounded border border-problem/30 bg-problem/5 px-3 py-2 text-sm text-problem">
          {result.ok} of {result.totalAttempted} nominations created. {result.failed} failed —
          click Submit again to retry the remaining.
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="flex-1 bg-white text-charcoal border border-slate/20 text-sm font-medium py-2.5 rounded-lg hover:bg-light-gray transition-colors disabled:opacity-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="flex-1 bg-navy text-white text-sm font-medium py-2.5 rounded-lg hover:bg-charcoal transition-colors disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : 'Submit nominations'}
        </button>
      </div>
    </div>
  );
}
