import type { GapDetailEntry } from '@/lib/haiwave-api';
import { ResolutionClassBadge } from './resolution-class-badge';

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const list = map.get(key(item)) ?? [];
    list.push(item);
    map.set(key(item), list);
  }
  return map;
}

export function GapDetail({ entries }: { entries: GapDetailEntry[] }) {
  if (entries.length === 0) {
    return (
      <section>
        <h2 className="font-display text-lg text-navy mb-3">Gap detail</h2>
        <p className="text-sm text-slate italic">No unresolved gaps for this vendor.</p>
      </section>
    );
  }

  const byProduct = groupBy(entries, (e) => e.product_id);

  return (
    <section>
      <h2 className="font-display text-lg text-navy mb-3">Gap detail</h2>
      <div className="space-y-4">
        {Array.from(byProduct.entries()).map(([productId, group]) => (
          <div key={productId} className="rounded-md border border-slate/20 bg-white p-4">
            <div className="mb-2 font-medium text-charcoal">{group[0].sku_label}</div>
            <div className="space-y-3 text-sm">
              {/* The actionable suggestion is canonical per gap kind; it was
                  repeated on every row. Group by gap kind so the kind, badge
                  and suggestion render once, with the per-occurrence depth /
                  country listed compactly beneath. */}
              {Array.from(groupBy(group, (e) => e.gap_kind).entries()).map(
                ([kind, kindRows]) => (
                  <div
                    key={kind}
                    className="border-t border-slate/10 pt-2 first:border-0 first:pt-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate">
                        {kind.replace(/_/g, '-')}
                      </span>
                      <ResolutionClassBadge
                        resolution_class={kindRows[0].resolution_class}
                      />
                    </div>
                    <div className="mt-1 text-slate">
                      {kindRows[0].actionable_suggestion}
                    </div>
                    <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate">
                      {kindRows.map((entry, i) => (
                        <li key={`${entry.product_id}-${i}`}>
                          depth {entry.depth_level}
                          {entry.declared_country ? ` · ${entry.declared_country}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
