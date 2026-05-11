'use client';

/**
 * Budget Configuration section (v1.30 spec §7.2).
 *
 * Read-only display of the participant's current hourly hop budget. The
 * "(custom)" vs "(platform default)" label is driven by the `is_custom`
 * flag from `/sonar/budget/current` — HaiWeb does not maintain its own
 * copy of haiCore's PLATFORM_DEFAULT_HOP_BUDGET so the label cannot lie
 * if haiCore changes the default.
 */
interface Props {
  budget: number;
  isCustom: boolean;
}

export function BudgetDisplay({ budget, isCustom }: Props) {
  return (
    <section className="bg-white border border-slate-200 rounded p-4">
      <h2 className="text-sm font-semibold text-charcoal uppercase tracking-wider">Budget</h2>
      <p className="text-sm mt-2">
        Your hourly budget: <span className="font-medium">{budget.toLocaleString()} hops</span>{' '}
        <span className="text-slate">({isCustom ? 'custom' : 'platform default'})</span>
      </p>
      <p className="text-xs text-slate mt-2">
        Need a higher limit? Email <a href="mailto:support@haiwave.ai" className="text-teal hover:underline">support@haiwave.ai</a>.
      </p>
    </section>
  );
}
