import { scoreBgClass } from "@/lib/score-tier";

interface ScoreBarProps {
  label: string;
  value: number;
  maxValue?: number;
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
          className={`h-full rounded-full transition-all ${scoreBgClass(value)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
