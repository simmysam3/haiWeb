'use client';

import { useEffect, useMemo, useState } from 'react';

interface PartnerRow {
  id: string;
  company_name: string;
  status: 'trading_pair' | 'approved' | (string & {});
  industry?: string;
  location?: string;
}

interface Props {
  value: string;
  onChange: (participantId: string) => void;
}

export function CounterpartyPicker({ value, onChange }: Props) {
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/account/partners');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as PartnerRow[];
        if (!cancelled) setPartners(Array.isArray(body) ? body : []);
      } catch {
        if (!cancelled) setError("Couldn't load trading partners. Try again in a moment.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const eligible = useMemo(
    () => partners.filter((p) => p.status === 'trading_pair'),
    [partners],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return eligible;
    return eligible.filter((p) => p.company_name.toLowerCase().includes(q));
  }, [eligible, query]);

  if (loading) return <p className="text-sm text-slate italic">Loading trading partners…</p>;
  if (error) {
    return (
      <div className="rounded border border-problem/30 bg-problem/5 px-3 py-2 text-sm text-problem">
        {error}
      </div>
    );
  }
  if (eligible.length === 0) {
    return (
      <div className="rounded border border-slate/20 bg-light-gray px-3 py-2 text-sm text-slate">
        No trading pairs yet. Phantom Demand can only run against an established
        trading pair — establish one from Trading Partners first.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search trading partners"
        placeholder="Search trading partners…"
        className="w-full px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
      />
      {filtered.length === 0 ? (
        <p className="text-sm text-slate italic">No matching trading partners.</p>
      ) : (
        <ul className="border border-slate/20 rounded-lg divide-y divide-slate/10 max-h-72 overflow-y-auto">
          {filtered.map((p) => {
            const selected = p.id === value;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onChange(p.id)}
                  className={`w-full text-left px-4 py-3 transition-colors ${
                    selected ? 'bg-teal/10' : 'hover:bg-light-gray'
                  }`}
                >
                  <p className="text-sm font-medium text-charcoal">
                    {p.company_name}
                    {selected && <span aria-hidden="true" className="ml-2 text-teal">✓</span>}
                  </p>
                  <p className="text-xs text-slate">
                    {[p.industry, p.location, p.status].filter(Boolean).join(' · ')}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
