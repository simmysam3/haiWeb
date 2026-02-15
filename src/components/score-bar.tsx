interface ScoreBarProps {
  label: string;
  value: number;
  maxValue?: number;
}

function scoreColor(value: number): string {
  if (value >= 90) return "bg-success";
  if (value >= 70) return "bg-teal";
  return "bg-problem";
}

export function ScoreBar({ label, value, maxValue = 100 }: ScoreBarProps) {
  const pct = Math.min(100, (value / maxValue) * 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-charcoal">{label}</span>
        <span className="text-sm font-bold text-navy">{value}</span>
      </div>
      <div className="w-full h-2 bg-slate/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${scoreColor(value)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
