export default function AdminDashboardPage() {
  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-navy mb-2">
        Admin Dashboard
      </h1>
      <p className="text-slate mb-8">
        HAIWAVE network administration. Requires admin:manage scope.
      </p>

      <div className="grid grid-cols-3 gap-6 mb-8">
        {[
          { label: "Registered Participants", value: "0" },
          { label: "Active Trading Pairs", value: "0" },
          { label: "Suspended Accounts", value: "0" },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-lg border border-slate/15 p-6">
            <p className="text-xs font-medium uppercase tracking-wider text-slate mb-2">
              {card.label}
            </p>
            <p className="text-2xl font-bold text-navy">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-slate/15 p-6">
        <p className="text-sm text-slate">
          Phase 1: participant counts by status, outstanding invoices, recent
          registrations, network health (agent status distribution), manual
          suspend/reactivate. Phase 2: connection request analytics, ban
          monitoring, abuse detection dashboards.
        </p>
      </div>
    </div>
  );
}
