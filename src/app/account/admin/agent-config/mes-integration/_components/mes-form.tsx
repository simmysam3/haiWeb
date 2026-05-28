'use client';
import { useState, useEffect, useRef } from 'react';

interface MesConfig {
  endpoint_url: string;
  auth_scheme: string;
  credential_ref: string;
  work_center_mapping: Record<string, string>;
}

const EMPTY_CONFIG: MesConfig = {
  endpoint_url: '',
  auth_scheme: 'bearer',
  credential_ref: '',
  work_center_mapping: {},
};

export function MesForm() {
  const [agentId, setAgentId] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [config, setConfig] = useState<MesConfig>(EMPTY_CONFIG);
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!agentId) {
      setStatus('idle');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    setErrorMsg('');
    fetch(`/api/account/admin/agent-config/mes-integration?agent_id=${encodeURIComponent(agentId)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (cancelled) return;
        setEnabled(d.mes_enabled);
        setConfig(d.mes_config ?? EMPTY_CONFIG);
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
      const res = await fetch('/api/account/admin/agent-config/mes-integration', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          agent_id: agentId,
          mes_enabled: enabled,
          mes_config: enabled ? config : null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus('saved');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setStatus('idle'), 2000);
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
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          disabled={!agentId || status === 'loading'}
        />
        Enable MES live capacity check
      </label>
      {enabled && (
        <div className="space-y-3 rounded bg-slate-50 p-3">
          <input
            type="text"
            placeholder="Endpoint URL (https://...)"
            value={config.endpoint_url}
            onChange={(e) => setConfig({ ...config, endpoint_url: e.target.value })}
            className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
          />
          <input
            type="text"
            placeholder="Auth scheme (e.g., bearer)"
            value={config.auth_scheme}
            onChange={(e) => setConfig({ ...config, auth_scheme: e.target.value })}
            className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
          />
          <input
            type="text"
            placeholder="Credential reference (env var name)"
            value={config.credential_ref}
            onChange={(e) => setConfig({ ...config, credential_ref: e.target.value })}
            className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
          />
          <p className="text-xs text-slate-500">
            Work-center mapping editing not yet exposed in this form — set via API.
          </p>
        </div>
      )}
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
