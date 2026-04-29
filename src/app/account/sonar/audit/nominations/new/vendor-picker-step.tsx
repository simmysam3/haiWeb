'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PartnerSummary } from './types';

interface PartnerRow {
  id: string;
  company_name: string;
  status: string;
}

export function VendorPickerStep({
  onAdvance,
}: {
  onAdvance: (vendor: PartnerSummary) => void;
}) {
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
        if (!cancelled) setPartners(body);
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return partners;
    return partners.filter((p) => p.company_name.toLowerCase().includes(q));
  }, [partners, query]);

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

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search vendors…"
        className="w-full px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
      />
      {filtered.length === 0 ? (
        <p className="text-sm text-slate italic">No matching vendors.</p>
      ) : (
        <ul className="border border-slate/20 rounded-lg divide-y divide-slate/10 max-h-80 overflow-y-auto">
          {filtered.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onAdvance({ id: p.id, legal_name: p.company_name })}
                className="w-full text-left px-4 py-3 hover:bg-light-gray transition-colors"
              >
                <p className="text-sm font-medium text-charcoal">{p.company_name}</p>
                <p className="text-xs text-slate">Status: {p.status}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
