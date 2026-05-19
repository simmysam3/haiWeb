import type { GapInventoryEntry, ResolutionClass } from '@/lib/haiwave-api';
import { ResolutionClassBadge } from './resolution-class-badge';

const GROUP_ORDER: ResolutionClass[] = ['agentic_eligible', 'out_of_band', 'pending'];

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const list = map.get(key(item)) ?? [];
    list.push(item);
    map.set(key(item), list);
  }
  return map;
}

export function GapInventory({ entries }: { entries: GapInventoryEntry[] }) {
  if (entries.length === 0) {
    return (
      <section>
        <h2 className="font-display text-lg text-navy mb-3">Gap inventory</h2>
        <p className="text-sm text-slate italic">No gaps surfaced for this run.</p>
      </section>
    );
  }

  const byClass = groupBy(entries, (e) => e.resolution_class);

  return (
    <section>
      <h2 className="font-display text-lg text-navy mb-3">Gap inventory</h2>
      <div className="space-y-4">
        {GROUP_ORDER.filter((c) => byClass.has(c)).map((cls) => {
          const group = byClass.get(cls) ?? [];
          // Vendor name and the (canonical-per-gap-kind) suggestion were
          // repeated on every row. Sub-group by vendor (most gaps first),
          // then by gap kind, so each appears exactly once.
          const byVendor = Array.from(
            groupBy(group, (e) => e.vendor_legal_name).entries(),
          ).sort((a, b) => b[1].length - a[1].length);
          return (
            <div key={cls} className="rounded-md border border-slate/20 bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <ResolutionClassBadge resolution_class={cls} />
                <span className="text-xs text-slate">
                  {group.length} {group.length === 1 ? 'gap' : 'gaps'}
                </span>
              </div>
              <div className="space-y-4">
                {byVendor.map(([vendorName, vendorRows]) => (
                  <div key={vendorName}>
                    <div className="text-charcoal">
                      <span className="font-medium">{vendorName}</span>{' '}
                      <span className="text-xs text-slate">
                        ({vendorRows.length} {vendorRows.length === 1 ? 'gap' : 'gaps'})
                      </span>
                    </div>
                    <div className="mt-1 space-y-2 text-sm">
                      {Array.from(groupBy(vendorRows, (e) => e.gap_kind).entries()).map(
                        ([kind, kindRows]) => (
                          <div key={kind}>
                            <span className="text-xs font-mono text-slate">
                              {kind.replace(/_/g, '-')}
                            </span>
                            <div className="text-slate">
                              {kindRows[0].actionable_suggestion}
                            </div>
                            <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate">
                              {kindRows.map((r, i) => (
                                <li key={`${r.product_id}-${i}`}>
                                  <span className="font-mono">{r.product_id}</span> · depth{' '}
                                  {r.depth_level}
                                  {r.declared_country ? ` · ${r.declared_country}` : ''}
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
            </div>
          );
        })}
      </div>
    </section>
  );
}
