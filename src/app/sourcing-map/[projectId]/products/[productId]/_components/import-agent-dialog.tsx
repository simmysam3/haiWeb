'use client';
import { useEffect, useId, useState } from 'react';
import type { AgentParentSkusResponse, ImportAgentBomResponse } from '@/lib/sourcing-map/contract';
import { smFetch } from '@/lib/sourcing-map/client';
import { SmDialog } from '../../../../_components/sm-dialog';

/** Import from agent (spec §7.5): R-6 listing plus a typed SKU; copy or link. */
export function ImportAgentDialog({ productId, open, onClose, onImported }: {
  productId: string; open: boolean; onClose(): void; onImported(r: ImportAgentBomResponse): void;
}) {
  const listId = useId();
  const [skus, setSkus] = useState<AgentParentSkusResponse['skus']>([]);
  const [sku, setSku] = useState('');
  const [mode, setMode] = useState<'copy' | 'link'>('copy');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    void smFetch<AgentParentSkusResponse>('/api/account/sourcing-map/agent-parent-skus').then((out) => {
      if (out.ok) setSkus(out.data.skus);
    });
  }, [open]);

  async function submit() {
    setBusy(true);
    setError(null);
    const out = await smFetch<ImportAgentBomResponse>(`/api/account/sourcing-map/products/${productId}/import-agent-bom`, {
      method: 'POST',
      body: { agent_root_sku: sku.trim(), mode },
    });
    setBusy(false);
    if (!out.ok) {
      // spec §7.5, §10: a 502 agent_unreachable creates nothing.
      setError(out.status === 502 ? 'Your agent did not answer. Nothing was created.' : out.message);
      return;
    }
    onImported(out.data);
  }

  return (
    <SmDialog
      title="Import from agent"
      open={open}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="sm-btn sm-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="sm-btn sm-btn-primary" disabled={busy || sku.trim() === ''} onClick={submit}>Import</button>
        </>
      }
    >
      <label className="block text-sm">
        Parent SKU
        <input list={listId} className="sm-input mt-1 w-full" value={sku} maxLength={200} onChange={(e) => setSku(e.target.value)} />
      </label>
      <datalist id={listId}>
        {skus.map((s) => <option key={s.sku} value={s.sku}>{s.product_name ? `${s.sku} · ${s.product_name}` : s.sku}</option>)}
      </datalist>
      <fieldset className="mt-4">
        <legend className="sm-muted text-sm">Mode</legend>
        <label className="mt-1 flex items-center gap-2 text-sm"><input type="radio" name="import-mode" checked={mode === 'copy'} onChange={() => setMode('copy')} />Copy into the workbench (editable lines, pinned and classed)</label>
        <label className="mt-1 flex items-center gap-2 text-sm"><input type="radio" name="import-mode" checked={mode === 'link'} onChange={() => setMode('link')} />Link (read fresh from your agent at every run)</label>
      </fieldset>
      {error && <p role="alert" className="sm-error mt-3 text-sm">{error}</p>}
    </SmDialog>
  );
}
