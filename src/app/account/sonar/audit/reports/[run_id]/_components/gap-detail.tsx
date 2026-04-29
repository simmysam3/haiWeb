import type { GapDetailEntry } from '@/lib/haiwave-api';
import { ResolutionClassBadge } from './resolution-class-badge';

export function GapDetail({ entries }: { entries: GapDetailEntry[] }) {
  if (entries.length === 0) {
    return (
      <section>
        <h2 className="font-display text-lg text-navy mb-3">Gap detail</h2>
        <p className="text-sm text-slate italic">No unresolved gaps for this vendor.</p>
      </section>
    );
  }

  const groups = new Map<string, GapDetailEntry[]>();
  for (const entry of entries) {
    const list = groups.get(entry.product_id) ?? [];
    list.push(entry);
    groups.set(entry.product_id, list);
  }

  return (
    <section>
      <h2 className="font-display text-lg text-navy mb-3">Gap detail</h2>
      <div className="space-y-4">
        {Array.from(groups.entries()).map(([productId, group]) => (
          <div key={productId} className="rounded-md border border-slate/20 bg-white p-4">
            <div className="mb-2 font-medium text-charcoal">{group[0].sku_label}</div>
            <ul className="space-y-2 text-sm">
              {group.map((entry, i) => (
                <li
                  key={`${entry.product_id}-${i}`}
                  className="border-t border-slate/10 pt-2 first:border-0 first:pt-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate">{entry.gap_kind.replace(/_/g, '-')}</span>
                    <ResolutionClassBadge resolution_class={entry.resolution_class} />
                    <span className="text-xs text-slate">depth {entry.depth_level}</span>
                    {entry.declared_country && (
                      <span className="text-xs text-slate">· {entry.declared_country}</span>
                    )}
                  </div>
                  <div className="mt-1 text-slate">{entry.actionable_suggestion}</div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
