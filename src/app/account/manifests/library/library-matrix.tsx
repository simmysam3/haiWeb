'use client';

import { useState } from 'react';
import type { LibraryView, LibraryElement, PolicyContext } from '@/lib/library-types';
import { LIBRARY_TIERS, TIER_LABELS, SECTION_LABELS, compactUsd } from '@/lib/library-types';
import { GroupedAccordion } from '@/components/grouped-accordion/grouped-accordion';
import { AccordionGroupRow } from '@/components/grouped-accordion/accordion-group-row';
import { EvidenceChip } from './evidence-chip';
import { GapBadge } from './gap-badge';
import { MatrixCell } from './matrix-cell';

/** Lowest tier at which this element's require policy is enabled, or undefined. */
function firstEnabledRequireTier(el: LibraryElement): (typeof LIBRARY_TIERS)[number] | undefined {
  return LIBRARY_TIERS.find((t) => el.policies.require[t]);
}

interface LibraryMatrixProps {
  view: LibraryView;
  context: PolicyContext;
  readOnly: boolean;
  onChanged: () => void;
  onAddEvidence: (el: LibraryElement) => void;
  onDraftAction?: (itemId: string, action: 'affirm' | 'reject') => void;
}

export function LibraryMatrix({
  view,
  context,
  readOnly,
  onChanged,
  onAddEvidence,
  onDraftAction,
}: LibraryMatrixProps) {
  const [gapsOnly, setGapsOnly] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(view.sections.map((s) => s.section)),
  );
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  // Per-element draft text for the Coverage-required amount input (require
  // context, amount elements). Undefined = follow the element's stored value.
  const [coverageDrafts, setCoverageDrafts] = useState<Record<string, string>>({});

  async function saveCoverage(el: LibraryElement, raw: string) {
    const trimmed = raw.trim();
    const required_value = trimmed === '' ? null : { min_amount_usd: Number(trimmed) };
    if (required_value && Number.isNaN(required_value.min_amount_usd)) return;
    try {
      const res = await fetch('/api/account/library/policies', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        // required_value rides the same require-context policy row; tier is not
        // meaningful for the per-element minimum, so send the lowest enabled (or
        // 'connection' default) — haiCore stores it tierlessly.
        body: JSON.stringify({
          element_key: el.key,
          context: 'require',
          tier: firstEnabledRequireTier(el) ?? 'connection',
          enabled: true,
          required_value,
        }),
      });
      if (!res.ok) throw new Error('save failed');
      setError(null);
      onChanged();
    } catch {
      setError(`Couldn't save Coverage required for ${el.label}.`);
    }
  }

  function toggleSection(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function toggleCell(el: LibraryElement, tier: (typeof LIBRARY_TIERS)[number]) {
    if (readOnly) return;
    const k = `${el.key}|${tier}`;
    if (pending.has(k)) return;
    const current = overrides[k] ?? el.policies[context][tier];
    const next = !current;
    setOverrides((prev) => ({ ...prev, [k]: next }));
    setPending((p) => new Set(p).add(k));

    try {
      const res = await fetch('/api/account/library/policies', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ element_key: el.key, context, tier, enabled: next }),
      });
      if (!res.ok) throw new Error('save failed');
      // On success drop the override so the cell follows the revalidated view.
      setOverrides((prev) => {
        const copy = { ...prev };
        delete copy[k];
        return copy;
      });
      setError(null);
      onChanged();
    } catch {
      setOverrides((prev) => {
        const copy = { ...prev };
        delete copy[k];
        return copy;
      });
      setError(`Couldn't save ${el.label} — ${TIER_LABELS[tier]}; reverted.`);
    } finally {
      setPending((p) => {
        const s = new Set(p);
        s.delete(k);
        return s;
      });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="inline-flex items-center gap-2 text-sm text-charcoal">
          <input
            type="checkbox"
            checked={gapsOnly}
            onChange={(e) => setGapsOnly(e.target.checked)}
          />
          Show gaps only
        </label>
      </div>

      {error && <p className="text-sm text-problem">{error}</p>}

      <GroupedAccordion>
        {view.sections.map((s) => {
          const total = s.elements.length;
          const filtered = gapsOnly ? s.elements.filter((el) => el.gap) : s.elements;
          const count = gapsOnly ? { filtered: filtered.length, total } : total;
          return (
            <AccordionGroupRow
              key={s.section}
              groupKey={s.section}
              label={SECTION_LABELS[s.section] ?? s.section}
              count={count}
              expanded={expanded.has(s.section)}
              onToggle={() => toggleSection(s.section)}
            >
              <table className="w-full text-sm">
                <colgroup>
                  <col style={{ width: '40%' }} />
                  {LIBRARY_TIERS.map((tier) => (
                    <col key={tier} style={{ width: '15%' }} />
                  ))}
                </colgroup>
                <thead>
                  <tr className="text-left text-xs text-slate">
                    <th scope="col" className="pb-1 font-medium">
                      Element
                    </th>
                    {LIBRARY_TIERS.map((tier) => (
                      <th key={tier} scope="col" className="pb-1 font-medium">
                        {TIER_LABELS[tier]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((el) => (
                    <tr key={el.key} className="border-t border-slate/10 align-top">
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-charcoal">{el.label}</span>
                          {el.gap && <GapBadge />}
                          {context === 'require' &&
                            el.value_type === 'amount' &&
                            el.required_value && (
                              <span className="rounded-full bg-teal/10 px-2 py-0.5 text-xs font-medium text-teal-dark">
                                ≥ {compactUsd(el.required_value.min_amount_usd)}
                              </span>
                            )}
                        </div>
                        <div className="mt-1">
                          <EvidenceChip
                            element={el}
                            onAdd={() => onAddEvidence(el)}
                            onDraftAction={onDraftAction}
                          />
                        </div>
                        {context === 'require' &&
                          el.value_type === 'amount' &&
                          firstEnabledRequireTier(el) && (
                            <label className="mt-2 flex items-center gap-2 text-xs text-slate">
                              <span>Coverage required (USD)</span>
                              <input
                                type="number"
                                min={0}
                                step={1000}
                                aria-label={`Coverage required — ${el.label}`}
                                disabled={readOnly}
                                value={
                                  coverageDrafts[el.key] ??
                                  (el.required_value ? String(el.required_value.min_amount_usd) : '')
                                }
                                onChange={(e) =>
                                  setCoverageDrafts((prev) => ({ ...prev, [el.key]: e.target.value }))
                                }
                                onBlur={(e) => saveCoverage(el, e.target.value)}
                                className="w-32 rounded-lg border border-slate/25 px-2 py-1 text-charcoal focus:border-teal focus:outline-none"
                              />
                            </label>
                          )}
                      </td>
                      {context === 'require' && el.requirable === false ? (
                        // Informational attribute (PO 2026-06-11): shared and
                        // listed, but it never backs an approval rule — no
                        // require switches to offer.
                        <td colSpan={LIBRARY_TIERS.length} className="py-2 text-xs text-slate">
                          Informational — shared with counterparties, never a requirement.
                        </td>
                      ) : (
                        LIBRARY_TIERS.map((tier) => {
                          const k = `${el.key}|${tier}`;
                          const effective = overrides[k] ?? el.policies[context][tier];
                          return (
                            <td key={tier} className="py-2">
                              <MatrixCell
                                enabled={effective}
                                context={context}
                                label={`${el.label} — ${TIER_LABELS[tier]}`}
                                disabled={readOnly || pending.has(k)}
                                onToggle={() => toggleCell(el, tier)}
                              />
                            </td>
                          );
                        })
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </AccordionGroupRow>
          );
        })}
      </GroupedAccordion>
    </div>
  );
}
