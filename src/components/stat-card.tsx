interface StatCardProps {
  label: string;
  /** The metric value. `null`/`undefined`/`""` renders "Not Available". */
  value: string | null | undefined;
  trend?: number;
  color?: string;
}

export function StatCard({ label, value, trend, color = "text-navy" }: StatCardProps) {
  const isAvailable = value != null && value !== "";

  return (
    <div className="bg-white rounded-lg border border-slate/15 p-6">
      <p className="text-xs font-medium uppercase tracking-wider text-slate mb-2">
        {label}
      </p>
      {isAvailable ? (
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
      ) : (
        <p className="text-2xl font-bold text-slate/60">Not Available</p>
      )}
      {isAvailable && trend !== undefined && trend !== 0 && (
        <p className={`text-xs mt-1 ${trend > 0 ? "text-success" : "text-problem"}`}>
          {trend > 0 ? "+" : ""}{trend}% vs last period
        </p>
      )}
    </div>
  );
}
