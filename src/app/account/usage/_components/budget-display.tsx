'use client';

/**
 * Budget Configuration section (v1.30 spec §7.2).
 *
 * Read-only display of the participant's current hourly hop budget *and*
 * phantom demand inbound probe limit. Both rows surface a "(custom)" vs
 * "(platform default)" tag driven by `is_custom` flags returned by
 * `/sonar/budget/current` — HaiWeb does not maintain its own copy of the
 * platform defaults so the labels cannot lie when haiCore changes its
 * constants.
 *
 * Probe-limit wording matches the spec verbatim:
 *   "Your phantom demand inbound probe limit: [N] probes per hour per
 *    trading pair."
 */
interface Props {
  budget: number;
  isCustom: boolean;
  probeLimit: number;
  probeLimitIsCustom: boolean;
}

export function BudgetDisplay({ budget, isCustom, probeLimit, probeLimitIsCustom }: Props) {
  return (
    <section className="bg-white border border-slate-200 rounded p-4">
      <h2 className="text-sm font-semibold text-charcoal uppercase tracking-wider">Budget</h2>
      <p className="text-sm mt-2">
        Your hourly budget: <span className="font-medium">{budget.toLocaleString()} hops</span>{' '}
        <span className="text-slate">({isCustom ? 'custom' : 'platform default'})</span>
      </p>
      <p className="text-sm mt-1">
        Your phantom demand inbound probe limit:{' '}
        <span className="font-medium">{probeLimit.toLocaleString()} probes per hour per trading pair</span>{' '}
        <span className="text-slate">({probeLimitIsCustom ? 'custom' : 'platform default'})</span>
      </p>
      <p className="text-xs text-slate mt-2">
        Need a higher limit? Email <a href="mailto:support@haiwave.ai" className="text-teal hover:underline">support@haiwave.ai</a>.
      </p>
    </section>
  );
}
