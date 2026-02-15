interface StatCardProps {
  label: string;
  value: string;
  trend?: number;
  color?: string;
}

export function StatCard({ label, value, trend, color = "text-navy" }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg border border-slate/15 p-6">
      <p className="text-xs font-medium uppercase tracking-wider text-slate mb-2">
        {label}
      </p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {trend !== undefined && trend !== 0 && (
        <p className={`text-xs mt-1 ${trend > 0 ? "text-success" : "text-problem"}`}>
          {trend > 0 ? "+" : ""}{trend}% vs last period
        </p>
      )}
    </div>
  );
}
