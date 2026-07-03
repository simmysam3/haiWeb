'use client';
import { useState } from 'react';
import { useAgentConfigResource } from '../../_lib/use-agent-config-resource';

type SkuPickerScope = 'published_only' | 'full_catalog';

interface ScopeGetResponse {
  sku_picker_scope: SkuPickerScope;
}

export function ScopeForm() {
  const [scope, setScope] = useState<SkuPickerScope>('published_only');
  const { agentId, setAgentId, status, errorMsg, save } = useAgentConfigResource<ScopeGetResponse>(
    '/api/account/admin/agent-config/sku-picker-scope',
    (d) => setScope(d.sku_picker_scope),
  );

  const handleSave = () => save({ sku_picker_scope: scope });

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
          onClick={handleSave}
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
