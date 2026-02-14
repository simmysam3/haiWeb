export default function DashboardPage() {
  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-navy mb-2">
        Dashboard
      </h1>
      <p className="text-slate mb-8">
        Account overview, agent status, and pending actions.
      </p>

      <div className="grid grid-cols-3 gap-6 mb-8">
        {[
          { label: "Account Status", value: "Active", color: "text-success" },
          { label: "Active Trading Pairs", value: "0", color: "text-navy" },
          { label: "Agents Online", value: "0 / 0", color: "text-navy" },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-lg border border-slate/15 p-6">
            <p className="text-xs font-medium uppercase tracking-wider text-slate mb-2">
              {card.label}
            </p>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-slate/15 p-6">
        <p className="text-sm text-slate">
          Dashboard widgets will display: pending partnership requests, recent
          behavioral score snapshots, next invoice date, and agent health
          overview.
        </p>
      </div>
    </div>
  );
}
