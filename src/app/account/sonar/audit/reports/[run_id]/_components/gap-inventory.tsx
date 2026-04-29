import type { GapInventoryEntry, ResolutionClass } from '@/lib/haiwave-api';
import { ResolutionClassBadge } from './resolution-class-badge';

const GROUP_ORDER: ResolutionClass[] = ['agentic_eligible', 'out_of_band', 'pending'];

export function GapInventory({ entries }: { entries: GapInventoryEntry[] }) {
  if (entries.length === 0) {
    return (
      <section>
        <h2 className="font-display text-lg text-navy mb-3">Gap inventory</h2>
        <p className="text-sm text-slate italic">No gaps surfaced for this run.</p>
      </section>
    );
  }

  const groups = new Map<ResolutionClass, GapInventoryEntry[]>();
  for (const entry of entries) {
    const list = groups.get(entry.resolution_class) ?? [];
    list.push(entry);
    groups.set(entry.resolution_class, list);
  }

  return (
    <section>
      <h2 className="font-display text-lg text-navy mb-3">Gap inventory</h2>
      <div className="space-y-4">
        {GROUP_ORDER.filter((c) => groups.has(c)).map((cls) => {
          const group = groups.get(cls) ?? [];
          return (
            <div key={cls} className="rounded-md border border-slate/20 bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <ResolutionClassBadge resolution_class={cls} />
                <span className="text-xs text-slate">
                  {group.length} {group.length === 1 ? 'gap' : 'gaps'}
                </span>
              </div>
              <ul className="space-y-2 text-sm">
                {group.map((entry, i) => (
                  <li
                    key={`${entry.vendor_participant_id}-${entry.product_id}-${i}`}
                    className="border-t border-slate/10 pt-2 first:border-0 first:pt-0"
                  >
                    <div className="font-medium text-charcoal">
                      <span>{entry.vendor_legal_name}</span>
                      {' — '}
                      <span>{entry.product_id}</span>
                    </div>
                    <div className="text-xs text-slate">
                      {entry.gap_kind.replace(/_/g, '-')} · depth {entry.depth_level}
                      {entry.declared_country ? ` · ${entry.declared_country}` : ''}
                    </div>
                    <div className="mt-1 text-slate">{entry.actionable_suggestion}</div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
