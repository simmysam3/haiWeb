'use client';
import type { SmCandidateResult2 } from '@/lib/sourcing-map/types';
import { bandVar, bandWord, candidateKeyOf, EM_DASH } from '@/lib/sourcing-map/map/selectors';
import { MAP_L, tiersOf } from '@/lib/sourcing-map/map/layout';

/**
 * Tier rows under an option card (spec §12.1): one row per tier present, one handle per sub-tier node. A handle is
 * the requirements §7.3 view of a node — alias letter, two-letter country (or "—"), the class at its floored level,
 * a band dot worded in title and aria-label — and never a quantity, an id or a name. Handles for one alias light
 * together on hover, across every card that carries it. Each handle is a <button>, so OptionCard's surface click
 * (ruling F-a) leaves it alone. `traced` marks the selected card: its trace's roles are drawn on its own handles.
 * A handle is one line (Task 13 fix round A): in a row too narrow for its handles the label truncates with an ellipsis,
 * the full label stays in the DOM (the accessible name) and in `title`, and the band dot and the role marker stay.
 * The row keeps its overflow visible so a handle's focus outline and hover ring are never clipped.
 */
export function TierRows({ candidate: c, traced, selectedAlias, onSelectAlias, hoveredAlias, onHoverAlias }: {
  candidate: SmCandidateResult2; traced: boolean;
  /** The alias selected on THIS card (the map canvas passes null to every other card, so a shared alias reads pressed only under the card it was pressed on). */
  selectedAlias: string | null; onSelectAlias(alias: string | null, origin: string): void;
  hoveredAlias: string | null; onHoverAlias(alias: string | null): void;
}) {
  const nodes = c.nodes ?? [];
  if (nodes.length === 0) return null;
  const key = candidateKeyOf(c);
  const traceNodes = new Map((traced ? c.trace?.nodes ?? [] : []).map((n) => [n.alias, n]));
  return (
    <div className="flex flex-col" style={{ marginTop: MAP_L.tierRowsTop }}>
      {tiersOf(nodes).map((tier) => (
        <div key={tier} role="group" aria-label={`Tier ${tier} under ${c.supplier_name}`} className="flex items-center gap-1" style={{ height: MAP_L.tierRowH }}>
          <span aria-hidden="true" className="sm-muted w-5 shrink-0 text-[10px]">{`T${tier}`}</span>
          {nodes.filter((n) => n.tier === tier).map((n) => {
            const t = traceNodes.get(n.alias);
            const lit = hoveredAlias === n.alias;
            const country = n.country ?? EM_DASH;
            const klass = n.class?.label ?? EM_DASH;
            const label = `${n.alias} · ${country} · ${klass}`;
            return (
              <button
                key={n.alias}
                type="button"
                data-anchor={`${key}/${n.alias}`}
                data-alias={n.alias}
                data-lit={lit ? 'true' : undefined}
                aria-pressed={selectedAlias === n.alias}
                title={label}
                onClick={() => onSelectAlias(selectedAlias === n.alias ? null : n.alias, key)}
                onMouseEnter={() => onHoverAlias(n.alias)}
                onMouseLeave={() => onHoverAlias(null)}
                onFocus={() => onHoverAlias(n.alias)}
                onBlur={() => onHoverAlias(null)}
                // .sm-btn (sourcing-map.css:16) is unlayered, so its padding and font-size outrank utilities; the row's size is inline.
                className="sm-btn sm-btn-ghost flex min-w-0 max-w-full items-center gap-1 whitespace-nowrap"
                style={{ height: MAP_L.tierRowH - 4, padding: '0 6px', fontSize: 11, boxShadow: lit ? '0 0 0 2px var(--sm-teal)' : undefined }}
              >
                <span className="min-w-0 truncate">{label}</span>
                {n.band !== null && (
                  <span role="img" aria-label={bandWord(n.band)} title={bandWord(n.band)} className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: bandVar(n.band) }} />
                )}
                {t && (
                  <span role="img" aria-label={t.role} title={t.role} className="shrink-0 font-semibold">{t.role === 'binding' ? String.fromCharCode(0x25cf) : String.fromCharCode(0x25cb)}</span>
                )}
                {t && t.binds_for > 1 && <span className="sm-warn shrink-0">{`Binding for ${t.binds_for} options`}</span>}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
