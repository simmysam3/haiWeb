'use client';
import type { SourcingMapExecutionResult2 } from '@/lib/sourcing-map/types';
import { bindingNodes, EM_DASH } from '@/lib/sourcing-map/map/selectors';
import { DetailChevron } from '@/components/sonar/observations/detail-chevron';

/**
 * Supply-chain limits (spec §12.3): every binding node on the map, by alias and tier, with the option it binds;
 * a click selects the first option it binds, which draws its trace. Nothing when no node binds — an SP1 result,
 * or a map whose shortfalls are all the suppliers' own.
 */
export function SupplyChainLimits({ result, onSelect }: {
  result: SourcingMapExecutionResult2; onSelect(candidate: { slot: number; candidate: number }): void;
}) {
  const nodes = bindingNodes(result);
  if (nodes.length === 0) return null;
  return (
    <section aria-label="Supply-chain limits" className="px-6 pt-3">
      <h3 className="sm-muted text-xs">Supply-chain limits</h3>
      <ul className="mt-1 flex flex-wrap gap-2">
        {nodes.map((n) => {
          const first = n.options[0]!;
          const label = n.options.length > 1
            ? `${n.alias} · tier ${n.tier} ${EM_DASH} Binding for ${n.options.length} options`
            : `${n.alias} · tier ${n.tier} ${EM_DASH} binding for ${first.name}`;
          return (
            <li key={n.alias}>
              <button type="button" className="group inline-flex items-center gap-2 sm-btn sm-btn-ghost text-xs" onClick={() => onSelect({ slot: first.slot, candidate: first.candidate })}>
                {label}
                <DetailChevron />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
