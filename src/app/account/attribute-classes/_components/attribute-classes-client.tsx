'use client';

import { useState } from 'react';
import type { AttributeClassProposal } from '@haiwave/protocol';
import { ProposeForm } from './propose-form';
import type { AttributeClassProposalRow, AttributeClassSummary } from '@/lib/safe-room-types';

export function AttributeClassesClient({ classes, initialProposals }: { classes: AttributeClassSummary[]; initialProposals: AttributeClassProposalRow[] }) {
  const [proposals, setProposals] = useState(initialProposals);
  const [error, setError] = useState<string | null>(null);

  /**
   * Final fix wave item 1: a rejected proposal must not fail silently. Mirrors the `putOrFail`
   * shape (disclosure-policy-client.tsx, Batch 1's I1) — check `res.ok`, keep prior state and
   * show the page's inline-alert convention (role="alert", text-problem) on failure.
   */
  async function submit(value: AttributeClassProposal) {
    const res = await fetch('/api/account/attribute-classes/proposals', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });
    if (!res.ok) {
      const text = await res.text();
      setError(`Save failed (${res.status}): ${text}`);
      return;
    }
    setError(null);
    const created = (await res.json()) as { proposal: AttributeClassProposalRow };
    setProposals((prev) => [created.proposal, ...prev]);
  }

  return (
    <>
      {error && <div role="alert" className="rounded-md border border-problem/30 bg-problem/10 px-4 py-3 text-sm text-problem">{error}</div>}
      <section><h2 className="mb-3 text-lg font-semibold text-charcoal">Adopted classes</h2><ul className="space-y-1 text-sm text-charcoal">{classes.map((c) => <li key={c.attribute_class_id}>{c.display_name}</li>)}</ul></section>
      <section><h2 className="mb-3 text-lg font-semibold text-charcoal">Propose a new class</h2><ProposeForm onSubmit={submit} /></section>
      {/* PF P9: the row's id is `id`, and its display name lives inside proposed_shape. */}
      <section><h2 className="mb-3 text-lg font-semibold text-charcoal">Your proposals</h2><ul className="space-y-1 text-sm text-charcoal">{proposals.map((p) => <li key={p.id}>{p.proposed_shape.display_name} — {p.status}</li>)}</ul></section>
    </>
  );
}
