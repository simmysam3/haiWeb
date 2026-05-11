'use client';

interface Props { budget: number; }

const PLATFORM_DEFAULT = 5000;

export function BudgetDisplay({ budget }: Props) {
  const isCustom = budget !== PLATFORM_DEFAULT;
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
