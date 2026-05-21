'use client';
import { useState } from 'react';
import { EVIDENCE_SCOPE_SHAPES, EVIDENCE_RECIPIENT_TYPES, type EvidenceScopeShape } from './evidence-protocol-mirror';
import { DispatchDecisionPanel, type DraftWire } from './dispatch-decision-panel';

function parseSkus(raw: string): string[] {
  return raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
}

export function ScopeEntryForm() {
  const [shape, setShape] = useState<EvidenceScopeShape>('sku_list');
  const [skusRaw, setSkusRaw] = useState('');
  const [familyClassId, setFamilyClassId] = useState('');
  const [containerRef, setContainerRef] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientOrg, setRecipientOrg] = useState('');
  const [recipientType, setRecipientType] = useState<(typeof EVIDENCE_RECIPIENT_TYPES)[number]>('customs');
  const [purpose, setPurpose] = useState('');
  const [deadline, setDeadline] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftWire | null>(null);

  const skus = parseSkus(skusRaw);
  const scopeOk =
    shape === 'product_family' ? familyClassId.trim().length > 0
    : shape === 'container_with_sku_list' ? skus.length > 0 && containerRef.trim().length > 0
    : skus.length > 0;
  const canSubmit = !submitting && recipientName.trim().length > 0 && recipientOrg.trim().length > 0 && scopeOk;

  async function submit() {
    setSubmitting(true); setError(null);
    try {
      const body: Record<string, unknown> = {
        scope_shape: shape,
        recipient_name: recipientName.trim(),
        recipient_org: recipientOrg.trim(),
        recipient_type: recipientType,
      };
      if (shape === 'product_family') body.family_class_node_id = familyClassId.trim();
      else { body.skus = skus; if (shape === 'container_with_sku_list') body.container_ref = containerRef.trim(); }
      if (purpose.trim()) body.purpose_narrative = purpose.trim();
      if (deadline) body.deadline = deadline;

      const res = await fetch('/api/account/sonar/compliance/evidence/draft', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) { setError(`Draft creation failed (${res.status})`); return; }
      setDraft((await res.json()) as DraftWire);
    } catch {
      setError('Draft creation failed — network error');
    } finally {
      setSubmitting(false);
    }
  }

  if (draft) return <DispatchDecisionPanel draft={draft} />;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-semibold text-charcoal">New evidence response</h1>

      <div role="tablist" aria-label="Scope shape" className="flex gap-2">
        {EVIDENCE_SCOPE_SHAPES.map((s) => (
          <button
            key={s} role="tab" id={`tab-${s}`} aria-controls={`panel-${s}`} aria-selected={shape === s} type="button"
            onClick={() => setShape(s)}
            className={`px-3 py-1.5 rounded text-sm ${shape === s ? 'bg-charcoal text-white' : 'bg-slate/10'}`}
          >
            {s === 'sku_list' ? 'SKU list' : s === 'product_family' ? 'Product family' : 'Container ref'}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="panel-sku_list" aria-labelledby="tab-sku_list">
        {shape === 'sku_list' && (
          <label className="block text-sm">SKUs
            <textarea aria-label="SKUs" value={skusRaw} onChange={(e) => setSkusRaw(e.target.value)}
              className="mt-1 w-full border rounded p-2" rows={4}
              placeholder="One per line, or comma/space separated" />
          </label>
        )}
      </div>
      <div role="tabpanel" id="panel-product_family" aria-labelledby="tab-product_family">
        {shape === 'product_family' && (
          <label className="block text-sm">Product class node id
            <input aria-label="Product family class" value={familyClassId}
              onChange={(e) => setFamilyClassId(e.target.value)} className="mt-1 w-full border rounded p-2" />
          </label>
        )}
      </div>
      <div role="tabpanel" id="panel-container_with_sku_list" aria-labelledby="tab-container_with_sku_list">
        {shape === 'container_with_sku_list' && (
          <div className="space-y-3">
            <label className="block text-sm">SKUs
              <textarea aria-label="SKUs" value={skusRaw} onChange={(e) => setSkusRaw(e.target.value)}
                className="mt-1 w-full border rounded p-2" rows={4}
                placeholder="One per line, or comma/space separated" />
            </label>
            <label className="block text-sm">Container reference
              <input aria-label="Container reference" value={containerRef}
                onChange={(e) => setContainerRef(e.target.value)} className="mt-1 w-full border rounded p-2" />
            </label>
          </div>
        )}
      </div>

      <fieldset className="space-y-3 border-t pt-4">
        <legend className="text-sm font-medium">Recipient</legend>
        <label className="block text-sm">Recipient name
          <input aria-label="Recipient name" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} className="mt-1 w-full border rounded p-2" />
        </label>
        <label className="block text-sm">Recipient org
          <input aria-label="Recipient org" value={recipientOrg} onChange={(e) => setRecipientOrg(e.target.value)} className="mt-1 w-full border rounded p-2" />
        </label>
        <label className="block text-sm">Recipient type
          <select aria-label="Recipient type" value={recipientType}
            onChange={(e) => setRecipientType(e.target.value as typeof recipientType)} className="mt-1 w-full border rounded p-2">
            {EVIDENCE_RECIPIENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="block text-sm">Purpose (optional)
          <input aria-label="Purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} className="mt-1 w-full border rounded p-2" />
        </label>
        <label className="block text-sm">Deadline (optional)
          <input type="date" aria-label="Deadline" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="mt-1 w-full border rounded p-2" />
        </label>
      </fieldset>

      {error && <p className="text-sm text-problem">{error}</p>}
      <button type="button" disabled={!canSubmit} onClick={submit}
        className="px-4 py-2 rounded bg-charcoal text-white disabled:opacity-40">
        {submitting ? 'Creating…' : 'Create draft'}
      </button>
    </div>
  );
}
