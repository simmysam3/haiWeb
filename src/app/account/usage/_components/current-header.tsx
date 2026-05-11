'use client';

interface Props {
  consumed: number;
  budget: number;
  windowStart: string;
}

export function CurrentHeader({ consumed, budget, windowStart }: Props) {
  const pct = budget > 0 ? Math.min(100, (consumed / budget) * 100) : 0;
  const barColor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-500' : 'bg-teal';
  return (
    <section className="bg-white border border-slate-200 rounded p-4 sticky top-0 z-10">
      <div className="flex items-baseline gap-2">
        <span className="text-sm text-slate">This hour:</span>
        <span className="text-2xl font-semibold text-charcoal">
          {consumed.toLocaleString()} / {budget.toLocaleString()}
        </span>
        <span className="text-sm text-slate">hops</span>
      </div>
      <div className="mt-2 h-2 bg-slate-100 rounded overflow-hidden">
        <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-slate mt-1">
        Window started {new Date(windowStart).toLocaleString()}
      </div>
    </section>
  );
}
