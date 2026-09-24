'use client';
import { useState } from 'react';
import type { ClassSuggestion, SmClassSearchResponse } from '@/lib/sourcing-map/contract';
import { smFetch } from '@/lib/sourcing-map/client';
import { Pill } from '@/components/pill';

type Picked = { class_id: string; label: string };

/** Taxonomy class picker with search (spec §7.2); shows the upload's suggestion chip when one exists. */
export function ClassPicker({ label, value, suggestion, onChange }: {
  label: string; value: Picked | null; suggestion: ClassSuggestion | null; onChange(c: Picked): void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SmClassSearchResponse['classes']>([]);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    setError(null);
    const out = await smFetch<SmClassSearchResponse>(`/api/account/sourcing-map/classes?q=${encodeURIComponent(q.trim())}`);
    if (!out.ok) {
      setError(out.message);
      return;
    }
    setResults(out.data.classes);
  }

  return (
    <div className="min-w-56">
      <div className="text-sm">{value ? value.label : <span className="sm-warn">Unclassified</span>}</div>
      {suggestion && !value && (
        <button
          type="button"
          className="mt-1 inline-flex items-center gap-2 text-xs"
          onClick={() => onChange({ class_id: suggestion.class_id, label: suggestion.label })}
        >
          <span>Use {suggestion.label}</span>
          <Pill themed category="sm_band" value={suggestion.band} />
        </button>
      )}
      <div className="mt-1 flex gap-1">
        <input aria-label={`Class search for ${label}`} className="sm-input w-36 text-xs" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" aria-label={`Find class for ${label}`} className="sm-btn sm-btn-ghost text-xs" disabled={q.trim().length < 2} onClick={search}>Find</button>
      </div>
      {error && <p role="alert" className="sm-error text-xs">{error}</p>}
      {results.length > 0 && (
        <ul className="mt-1 space-y-1">
          {results.map((c) => (
            <li key={c.class_id}>
              <button type="button" className="sm-link text-left text-xs" onClick={() => { onChange({ class_id: c.class_id, label: c.label }); setResults([]); }}>
                {c.class_path.join(' › ')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
