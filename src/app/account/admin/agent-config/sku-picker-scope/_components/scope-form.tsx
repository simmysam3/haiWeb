'use client';
import { useState, useEffect } from 'react';

export function ScopeForm() {
  const [agentId, setAgentId] = useState('');
  const [scope, setScope] = useState<'published_only' | 'full_catalog'>('published_only');
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!agentId) {
      setStatus('idle');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    setErrorMsg('');
    fetch(`/api/account/admin/agent-config/sku-picker-scope?agent_id=${encodeURIComponent(agentId)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (cancelled) return;
        setScope(d.sku_picker_scope);
        setStatus('idle');
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(err.message);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  const save = async () => {
    setStatus('saving');
    setErrorMsg('');
    try {
      const res = await fetch('/api/account/admin/agent-config/sku-picker-scope', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId, sku_picker_scope: scope }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  };

  return (
    <div className="space-y-4 rounded border border-slate-200 bg-white p-4">
      <div>
        <label className="block text-sm font-medium text-slate-700">Agent</label>
        <input
          type="text"
          placeholder="agent UUID"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 font-mono text-sm"
        />
      </div>
      <fieldset disabled={!agentId || status === 'loading'}>
        <legend className="text-sm font-medium text-slate-700">Scope</legend>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="scope"
            value="published_only"
            checked={scope === 'published_only'}
            onChange={() => setScope('published_only')}
          />
          Published catalog only
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="scope"
            value="full_catalog"
            checked={scope === 'full_catalog'}
            onChange={() => setScope('full_catalog')}
          />
          Full catalog (published + draft)
        </label>
      </fieldset>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={!agentId || status === 'saving' || status === 'loading'}
          className="rounded bg-teal-600 px-4 py-2 text-sm text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {status === 'saving' ? 'Saving…' : 'Save'}
        </button>
        {status === 'saved' && <span className="text-sm text-emerald-600">Saved</span>}
        {status === 'error' && <span className="text-sm text-red-600">{errorMsg}</span>}
      </div>
    </div>
  );
}
