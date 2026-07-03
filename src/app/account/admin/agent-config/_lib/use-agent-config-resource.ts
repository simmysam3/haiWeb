'use client';
import { useEffect, useRef, useState } from 'react';

export type AgentConfigResourceStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

export interface UseAgentConfigResourceResult {
  agentId: string;
  setAgentId: (id: string) => void;
  status: AgentConfigResourceStatus;
  errorMsg: string;
  save: (body: Record<string, unknown>) => Promise<void>;
}

/**
 * Shared load/save scaffolding for the per-agent config forms under
 * admin/agent-config (mes-integration, sku-picker-scope): agentId input,
 * load-on-agentId-change with request cancellation, a save PUT, an
 * idle/loading/saving/saved/error status machine, and the 2s saved-timer.
 *
 * `onLoad` fires synchronously inside the GET's `.then()` (not via a
 * derived-state effect) so the caller's field state updates land in the
 * same tick as `status` flipping to 'idle' — matching the pre-extraction
 * timing the forms' tests pin. A ref holds the latest `onLoad` so it can
 * be an inline closure without re-triggering the fetch effect.
 */
export function useAgentConfigResource<T>(
  endpoint: string,
  onLoad: (data: T) => void,
): UseAgentConfigResourceResult {
  const [agentId, setAgentId] = useState('');
  const [status, setStatus] = useState<AgentConfigResourceStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;

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
    fetch(`${endpoint}?agent_id=${encodeURIComponent(agentId)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: T) => {
        if (cancelled) return;
        onLoadRef.current(d);
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
  }, [agentId, endpoint]);

  const save = async (body: Record<string, unknown>) => {
    setStatus('saving');
    setErrorMsg('');
    try {
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId, ...body }),
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

  return { agentId, setAgentId, status, errorMsg, save };
}
