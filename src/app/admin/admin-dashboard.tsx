"use client";

import { useState } from "react";
import { StatCard } from "@/components/stat-card";
import { Card } from "@/components/card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/button";
import { MOCK_ADMIN_STATS, MOCK_ADMIN_PARTICIPANTS } from "@/lib/mock-data";

export function AdminDashboard() {
  const stats = MOCK_ADMIN_STATS;
  const recentRegistrations = MOCK_ADMIN_PARTICIPANTS.slice(-5).reverse();
  const suspended = MOCK_ADMIN_PARTICIPANTS.filter((p) => p.status === "suspended");
  const [toast, setToast] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  const agentTotal = stats.agent_health.active + stats.agent_health.jailed + stats.agent_health.probation + stats.agent_health.offline;
  const healthSegments = [
    { label: "Active", count: stats.agent_health.active, color: "bg-success" },
    { label: "Probation", count: stats.agent_health.probation, color: "bg-warning" },
    { label: "Jailed", count: stats.agent_health.jailed, color: "bg-problem" },
    { label: "Offline", count: stats.agent_health.offline, color: "bg-slate/30" },
  ];

  return (
    <div className="space-y-8">
      {toast && (
        <div className="bg-success/5 border border-success/20 rounded-lg px-4 py-3 text-sm text-success">
          {toast}
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-6">
        <StatCard
          label="Participants"
          value={stats.participants.total.toString()}
          color="text-navy"
        />
        <StatCard
          label="Trading Pairs"
          value={stats.trading_pairs.toString()}
          color="text-navy"
        />
        <StatCard
          label="Outstanding Invoices"
          value={`$${stats.outstanding_amount.toLocaleString()}`}
          color="text-warning"
        />
        <StatCard
          label="Agent Health"
          value={`${stats.agent_health.active}/${agentTotal} active`}
          color={stats.agent_health.jailed > 0 ? "text-warning" : "text-success"}
        />
      </div>

      {/* Recent Registrations */}
      <Card title="Recent Registrations">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate/15">
                <th className="text-left text-xs font-medium uppercase tracking-wider text-slate py-3 px-4">Company</th>
                <th className="text-left text-xs font-medium uppercase tracking-wider text-slate py-3 px-4">Location</th>
                <th className="text-left text-xs font-medium uppercase tracking-wider text-slate py-3 px-4">Registered</th>
                <th className="text-left text-xs font-medium uppercase tracking-wider text-slate py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentRegistrations.map((p) => (
                <tr key={p.id} className="border-b border-slate/10 hover:bg-light-gray/50">
                  <td className="py-3 px-4 font-medium text-charcoal">{p.company_name}</td>
                  <td className="py-3 px-4 text-slate">{p.location}</td>
                  <td className="py-3 px-4 text-slate">{new Date(p.registered_at).toLocaleDateString()}</td>
                  <td className="py-3 px-4"><StatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Suspended Accounts */}
      <Card title="Suspended Accounts">
        {suspended.length === 0 ? (
          <p className="text-sm text-slate text-center py-4">No suspended accounts.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate/15">
                  <th className="text-left text-xs font-medium uppercase tracking-wider text-slate py-3 px-4">Company</th>
                  <th className="text-left text-xs font-medium uppercase tracking-wider text-slate py-3 px-4">Reason</th>
                  <th className="text-left text-xs font-medium uppercase tracking-wider text-slate py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {suspended.map((p) => (
                  <tr key={p.id} className="border-b border-slate/10">
                    <td className="py-3 px-4 font-medium text-charcoal">{p.company_name}</td>
                    <td className="py-3 px-4 text-slate">{p.suspension_reason}</td>
                    <td className="py-3 px-4">
                      <Button size="sm" variant="secondary" onClick={() => showToast(`Reactivated ${p.company_name} (mock)`)}>
                        Reactivate
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Network Health */}
      <Card title="Network Health — Agent Status Distribution">
        <div className="flex h-6 rounded-full overflow-hidden mb-4">
          {healthSegments.map((seg) => (
            seg.count > 0 && (
              <div
                key={seg.label}
                className={`${seg.color} transition-all`}
                style={{ width: `${(seg.count / agentTotal) * 100}%` }}
                title={`${seg.label}: ${seg.count}`}
              />
            )
          ))}
        </div>
        <div className="flex gap-6">
          {healthSegments.map((seg) => (
            <div key={seg.label} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${seg.color}`} />
              <span className="text-xs text-slate">{seg.label}: {seg.count} ({Math.round((seg.count / agentTotal) * 100)}%)</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
