'use client';
import { useRef, useState } from 'react';
import type { ClassSuggestion, SmClassSearchResponse } from '@/lib/sourcing-map/contract';
import { smFetch } from '@/lib/sourcing-map/client';
import { Pill } from '@/components/pill';

type Picked = { class_id: string; label: string };

/** Taxonomy class picker with search (spec §7.2); shows the upload's suggestion chip when one exists. */
export function ClassPicker({ label, value, suggestion, onChange, inputRef, locked = false }: {
  label: string; value: Picked | null; suggestion: ClassSuggestion | null; onChange(c: Picked): void;
  /** The search input, for a neighbour that must hand focus here (the pin editor's last-pin Remove, L176). */
  inputRef?(el: HTMLInputElement | null): void;
  /** stale-lock: the grid is read-only. */
  locked?: boolean;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SmClassSearchResponse['classes']>([]);
  const [error, setError] = useState<string | null>(null);
  // A pick unmounts the control that made it (the chip or the result), so focus goes to the search (WCAG 2.4.3).
  const searchRef = useRef<HTMLInputElement>(null);

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
          onClick={() => {
            onChange({ class_id: suggestion.class_id, label: suggestion.label });
            searchRef.current?.focus();
          }}
        >
          <span>Use {suggestion.label}</span>
          <Pill themed category="sm_band" value={suggestion.band} />
        </button>
      )}
      <div className="mt-1 flex gap-1">
        <input
          ref={(el) => {
            searchRef.current = el;
            inputRef?.(el);
          }}
          aria-label={`Class search for ${label}`} className="sm-input w-36 text-xs" readOnly={locked} value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" aria-label={`Find class for ${label}`} className="sm-btn sm-btn-ghost text-xs" disabled={q.trim().length < 2} onClick={search}>Find</button>
      </div>
      {error && <p role="alert" className="sm-error text-xs">{error}</p>}
      {results.length > 0 && (
        <ul className="mt-1 space-y-1">
          {results.map((c) => (
            <li key={c.class_id}>
              <button type="button" className="sm-link text-left text-xs" onClick={() => { onChange({ class_id: c.class_id, label: c.label }); setResults([]); searchRef.current?.focus(); }}>
                {c.class_path.join(' › ')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
