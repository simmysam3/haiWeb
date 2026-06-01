'use client';

import { useState } from 'react';

export interface AliasItem {
  id?: string;
  alias: string;
  alias_type?: string;
  source?: string;
}

export interface AliasSuggestContext {
  legal_name: string;
  dba_name?: string;
  website_url?: string;
  vendor_description?: string;
}

interface AliasEditorProps {
  /** Aliases already added (chips). */
  aliases: AliasItem[];
  /** Context passed to the model for suggestions. */
  suggestContext: AliasSuggestContext;
  /** Parent persists/dedupes; returns once the alias is committed. */
  onAdd: (alias: string) => void | Promise<void>;
  onRemove: (item: AliasItem) => void | Promise<void>;
  /** Disable all controls (e.g. while a parent request is in flight). */
  disabled?: boolean;
}

/**
 * Shared chip editor for company-name aliases. Renders the current aliases as
 * removable chips, a free-text add box, and a "Suggest names" button that asks
 * the model (via /api/aliases/suggest) for abbreviations / tickers / short
 * forms and offers them as one-click add-able chips. Persistence is the
 * parent's job (local array on registration; BFF calls on the profile page).
 */
export function AliasEditor({ aliases, suggestContext, onAdd, onRemove, disabled }: AliasEditorProps) {
  const [draft, setDraft] = useState('');
  const [suggestions, setSuggestions] = useState<{ alias: string; alias_type: string }[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const existing = new Set(aliases.map((a) => a.alias.trim().toLowerCase()));

  function commit(value: string) {
    const v = value.trim();
    if (!v || existing.has(v.toLowerCase())) return;
    void onAdd(v);
  }

  function addDraft() {
    commit(draft);
    setDraft('');
  }

  async function suggest() {
    if (!suggestContext.legal_name.trim()) {
      setSuggestError('Enter the company name first.');
      return;
    }
    setSuggesting(true);
    setSuggestError(null);
    try {
      const res = await fetch('/api/aliases/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(suggestContext),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { suggestions?: { alias: string; alias_type: string }[] };
      setSuggestions(body.suggestions ?? []);
      if ((body.suggestions ?? []).length === 0) {
        setSuggestError('No suggestions found — add any aliases manually.');
      }
    } catch {
      setSuggestError("Couldn't fetch suggestions. Add aliases manually.");
    } finally {
      setSuggesting(false);
    }
  }

  const freshSuggestions = suggestions.filter((s) => !existing.has(s.alias.trim().toLowerCase()));

  return (
    <div className="space-y-2">
      {/* Current alias chips */}
      {aliases.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {aliases.map((a) => (
            <span
              key={a.id ?? a.alias}
              className="inline-flex items-center gap-1 rounded-full bg-teal/10 text-teal text-xs font-medium px-2.5 py-1"
            >
              {a.alias}
              <button
                type="button"
                disabled={disabled}
                onClick={() => void onRemove(a)}
                aria-label={`Remove ${a.alias}`}
                className="text-teal/70 hover:text-teal disabled:opacity-50"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add box + suggest */}
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addDraft();
            }
          }}
          placeholder="Add an alias (e.g. US Steel, USS)…"
          className="flex-1 px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal disabled:bg-light-gray"
        />
        <button
          type="button"
          onClick={addDraft}
          disabled={disabled || !draft.trim()}
          className="px-3 py-2 text-sm font-medium text-charcoal border border-slate/20 rounded-lg hover:bg-light-gray transition-colors disabled:opacity-50"
        >
          Add
        </button>
        <button
          type="button"
          onClick={suggest}
          disabled={disabled || suggesting}
          className="px-3 py-2 text-sm font-medium text-teal border border-teal/30 rounded-lg hover:bg-teal/5 transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {suggesting ? 'Suggesting…' : 'Suggest names'}
        </button>
      </div>

      {suggestError && <p className="text-xs text-slate">{suggestError}</p>}

      {/* Suggestion chips (click to add) */}
      {freshSuggestions.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-slate">Suggested — click to add:</p>
          <div className="flex flex-wrap gap-1.5">
            {freshSuggestions.map((s) => (
              <button
                key={s.alias}
                type="button"
                disabled={disabled}
                onClick={() => commit(s.alias)}
                className="inline-flex items-center gap-1 rounded-full border border-slate/20 text-charcoal text-xs px-2.5 py-1 hover:border-teal hover:text-teal transition-colors disabled:opacity-50"
              >
                + {s.alias}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
