'use client';
import { useId } from 'react';
import type { SmEstimateResponse, SmReadinessRule } from '@/lib/sourcing-map/contract';
import { SmButton } from '@/app/sourcing-map/_components/sm-button';

/** Wording for a readiness rule when haiCore sends no detail (a-G12: the window rule measures need-weeks). */
const RULE_TEXT: Record<SmReadinessRule, string> = {
  no_products: 'Add at least one product to the run.',
  agent_root_sku_missing: 'An agent product has no parent SKU.',
  no_lines: 'A workbench product has no BOM lines.',
  line_missing_class: 'A BOM line has no class.',
  qty_by_variant_key_unknown: "A size-bound line names a size that isn't on its product.",
  mix_missing: 'A product with sizes has no size mix.',
  mix_keys_mismatch: "A size mix doesn't cover exactly its product's sizes.",
  mix_not_100: "A size mix doesn't total 100%.",
  drops_outside_window: "The run's component need-dates span more than 104 weeks.",
};

/**
 * Run (spec §6.2, §8.3, AC 10): disabled until readiness holds, with the first
 * failing rule as visible, described text; the probe estimate shows before start.
 */
export function RunButton({ estimate, blockedReason, running, busy, onRun }: {
  estimate: SmEstimateResponse | null; blockedReason: string | null; running: boolean; busy: boolean; onRun(): void;
}) {
  const reasonId = useId();
  const reason =
    running ? 'An execution is running.'
    : blockedReason ?? (estimate === null ? 'Checking whether the run is ready…'
      : estimate.readiness.ready ? null
      : estimate.readiness.detail ?? RULE_TEXT[estimate.readiness.first_failing_rule as SmReadinessRule] ?? 'The run is not ready.');
  return (
    <span className="flex flex-col items-end">
      {/* LW-a: never `disabled`, which would drop focus to <body> when a press turns it to "An execution is running.";
          every reason it is unavailable is described through aria-describedby. */}
      <SmButton className="sm-btn sm-btn-primary" busy={busy} aria-disabled={reason !== null} aria-describedby={reason ? reasonId : undefined} onClick={onRun}>
        Run
      </SmButton>
      {reason ? (
        <span id={reasonId} className="sm-muted mt-1 text-xs">{reason}</span>
      ) : (
        estimate && (
          <span className="sm-muted mt-1 text-xs">
            <span>{`${estimate.slot_count} slot${estimate.slot_count === 1 ? '' : 's'} · ${estimate.probe_count} probe${estimate.probe_count === 1 ? '' : 's'} (up to ${estimate.probe_count_worst_case} with re-probes)`}</span>
            {estimate.responders_short.map((r) => (
              <span key={r.participant_id} className="sm-warn block">
                {`${r.legal_name} has ${r.remaining_allowance} probe${r.remaining_allowance === 1 ? '' : 's'} left this hour for ${r.probes_planned} planned.`}
              </span>
            ))}
          </span>
        )
      )}
    </span>
  );
}
