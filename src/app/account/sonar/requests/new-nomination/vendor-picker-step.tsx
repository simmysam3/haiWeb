'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PartnerSummary } from './types';

interface PartnerRow {
  id: string;
  company_name: string;
  status: string; // relationship_state: approved | trading_pair
}

interface DirectoryRow {
  id: string;
  company_name: string;
  location: string;
  industry: string;
  description: string;
  connection_status: 'none' | 'pending' | 'approved' | 'trading_pair' | 'banned';
}

type RequestState = 'idle' | 'requesting' | 'pending' | 'connected' | 'blocked' | 'error';

export function VendorPickerStep({
  onAdvance,
}: {
  onAdvance: (vendor: PartnerSummary) => void;
}) {
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  // Whole-network (directory) search — populated only while a query is active.
  const [network, setNetwork] = useState<DirectoryRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);

  // Per-participant connection-request state, keyed by participant id.
  const [reqState, setReqState] = useState<Record<string, RequestState>>({});
  const [reqError, setReqError] = useState<Record<string, string>>({});

  const loadPartners = useCallback(async () => {
    const res = await fetch('/api/account/partners');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as PartnerRow[];
    setPartners(body);
  }, []);

  // Load established trading pairs once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadPartners();
      } catch {
        if (!cancelled) setError("Couldn't load trading partners. Try again in a moment.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPartners]);

  // Debounced whole-network search. haiCore requires q ≥ 2 chars, so below that
  // we clear the network section rather than firing empty queries.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setNetwork([]);
      setNetworkError(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/account/directory?q=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as DirectoryRow[];
        if (!cancelled) {
          setNetwork(body);
          setNetworkError(null);
        }
      } catch {
        if (!cancelled) {
          setNetworkError("Couldn't search the HaiWave network. Try again in a moment.");
          setNetwork([]);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  // Trading Pairs section: existing connections, filtered client-side by name.
  const tradingPairs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return partners;
    return partners.filter((p) => p.company_name.toLowerCase().includes(q));
  }, [partners, query]);

  // HaiWave Network section: directory hits that are NOT already established
  // connections (those float up under Trading Pairs instead).
  const partnerIds = useMemo(() => new Set(partners.map((p) => p.id)), [partners]);
  const networkResults = useMemo(
    () =>
      network.filter(
        (c) =>
          !partnerIds.has(c.id) &&
          c.connection_status !== 'approved' &&
          c.connection_status !== 'trading_pair',
      ),
    [network, partnerIds],
  );

  function effectiveState(c: DirectoryRow): RequestState {
    if (reqState[c.id]) return reqState[c.id];
    if (c.connection_status === 'pending') return 'pending';
    if (c.connection_status === 'banned') return 'blocked';
    return 'idle';
  }

  async function requestConnection(c: DirectoryRow) {
    setReqState((s) => ({ ...s, [c.id]: 'requesting' }));
    setReqError((s) => {
      const next = { ...s };
      delete next[c.id];
      return next;
    });
    try {
      const res = await fetch('/api/account/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_participant_id: c.id }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        status?: string;
        relationship_state?: string;
      };

      if (res.status === 403) {
        setReqState((s) => ({ ...s, [c.id]: 'error' }));
        setReqError((s) => ({
          ...s,
          [c.id]: 'You need account-admin permissions to request a connection.',
        }));
        return;
      }
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);

      const autoApproved =
        body.status === 'auto_approved' ||
        body.relationship_state === 'approved' ||
        body.relationship_state === 'trading_pair';

      if (autoApproved) {
        // Now an established connection — pull it into the Trading Pairs section
        // so it becomes selectable for nomination.
        setReqState((s) => ({ ...s, [c.id]: 'connected' }));
        try {
          await loadPartners();
        } catch {
          /* picker still usable; the new pair just won't show until reload */
        }
      } else {
        setReqState((s) => ({ ...s, [c.id]: 'pending' }));
      }
    } catch (e) {
      setReqState((s) => ({ ...s, [c.id]: 'error' }));
      setReqError((s) => ({
        ...s,
        [c.id]: e instanceof Error ? e.message : 'Request failed. Try again in a moment.',
      }));
    }
  }

  if (loading) {
    return <p className="text-sm text-slate italic">Loading trading partners…</p>;
  }

  if (error) {
    return (
      <div className="rounded border border-problem/30 bg-problem/5 px-3 py-2 text-sm text-problem">
        {error}
      </div>
    );
  }

  const hasQuery = query.trim().length >= 2;

  return (
    <div className="space-y-5">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search trading pairs and the HaiWave network…"
        className="w-full px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
      />

      {/* ── Trading Pairs ─────────────────────────────────────────────── */}
      <section className="space-y-2">
        <h3 className="text-xs uppercase tracking-wider text-slate font-medium">
          Trading partners{tradingPairs.length > 0 ? ` (${tradingPairs.length})` : ''}
        </h3>
        {tradingPairs.length === 0 ? (
          <p className="text-sm text-slate italic">
            {query.trim()
              ? 'No trading partners match.'
              : 'No trading partners yet — search the HaiWave network below to connect with one.'}
          </p>
        ) : (
          <ul className="border border-slate/20 rounded-lg divide-y divide-slate/10 max-h-72 overflow-y-auto">
            {tradingPairs.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onAdvance({ id: p.id, legal_name: p.company_name })}
                  className="w-full text-left px-4 py-3 hover:bg-light-gray transition-colors"
                >
                  <p className="text-sm font-medium text-charcoal">{p.company_name}</p>
                  <p className="text-xs text-slate">
                    {p.status === 'trading_pair' ? 'Trading pair' : 'Approved connection'}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── HaiWave Network ───────────────────────────────────────────── */}
      <section className="space-y-2">
        <h3 className="text-xs uppercase tracking-wider text-slate font-medium">
          HaiWave network
        </h3>

        {!hasQuery ? (
          <p className="text-sm text-slate italic">
            Type at least 2 characters to find companies across the HaiWave network and request a
            new connection.
          </p>
        ) : searching ? (
          <p className="text-sm text-slate italic">Searching the HaiWave network…</p>
        ) : networkError ? (
          <div className="rounded border border-problem/30 bg-problem/5 px-3 py-2 text-sm text-problem">
            {networkError}
          </div>
        ) : networkResults.length === 0 ? (
          <p className="text-sm text-slate italic">
            No other companies on the network match that search.
          </p>
        ) : (
          <ul className="border border-slate/20 rounded-lg divide-y divide-slate/10 max-h-72 overflow-y-auto">
            {networkResults.map((c) => {
              const state = effectiveState(c);
              const subtitle = [c.location, c.industry].filter(Boolean).join(' · ');
              return (
                <li key={c.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-charcoal truncate">{c.company_name}</p>
                      {subtitle && <p className="text-xs text-slate truncate">{subtitle}</p>}
                    </div>
                    <div className="shrink-0">
                      {state === 'idle' && (
                        <button
                          type="button"
                          onClick={() => requestConnection(c)}
                          className="text-xs font-medium text-teal hover:text-teal/80 transition-colors whitespace-nowrap"
                        >
                          Request connection
                        </button>
                      )}
                      {state === 'requesting' && (
                        <span className="text-xs text-slate italic">Requesting…</span>
                      )}
                      {state === 'pending' && (
                        <span className="text-xs text-slate">Request pending</span>
                      )}
                      {state === 'connected' && (
                        <span className="text-xs text-teal font-medium">Connected</span>
                      )}
                      {state === 'blocked' && (
                        <span className="text-xs text-problem">Blocked</span>
                      )}
                      {state === 'error' && (
                        <button
                          type="button"
                          onClick={() => requestConnection(c)}
                          className="text-xs font-medium text-problem hover:text-problem/80 transition-colors whitespace-nowrap"
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  </div>
                  {reqError[c.id] && (
                    <p className="mt-1 text-xs text-problem">{reqError[c.id]}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
