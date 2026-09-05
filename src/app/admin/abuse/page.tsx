"use client";

import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/card";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { useApi } from "@/lib/use-api";

interface AbuseMonitoring {
  active_blocks: number;
  blocks_30d: number;
  spam_signals: { participant_id: string; name: string; signal_type: string; count: number }[];
  trust_anomalies: { participant_id: string; name: string; anomaly: string }[];
}

export default function AbusePage() {
  // Absence surfaces as absence (admin-dashboard.tsx): no seeded counts; a
  // failed read is a visible notice and the tiles show "Not Available"
  // (SEC-web-admin-ops-1-05).
  const { data, error } = useApi<AbuseMonitoring | null>({
    url: "/api/admin/dashboard?type=abuse",
    fallback: null,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Ban & Abuse Monitoring"
        description="Detect abuse patterns and monitor block activity."
      />

      {error && (
        <div role="alert" className="bg-problem/5 border border-problem/20 rounded-lg px-4 py-3 text-sm text-problem">
          Couldn&apos;t load abuse monitoring — haiCore answered {error}. Tiles show absence rather than stale or fabricated numbers.
        </div>
      )}
      <div className="grid grid-cols-3 gap-6">
        <StatCard label="Active Blocks" value={data ? data.active_blocks.toString() : null} color="text-problem" />
        <StatCard label="Blocks (30d)" value={data ? data.blocks_30d.toString() : null} color="text-warning" />
        <StatCard label="Spam Signals" value={data ? data.spam_signals.length.toString() : null} color={(data?.spam_signals.length ?? 0) > 0 ? "text-problem" : "text-success"} />
      </div>

      <Card title="High-Volume Connection Requests">
        {!data ? (
          <p className="text-sm text-slate text-center py-8">Spam signals could not be loaded.</p>
        ) : data.spam_signals.length === 0 ? (
          <p className="text-sm text-slate text-center py-8">No spam signals detected.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate/15">
                  <th className="text-left text-xs font-medium uppercase tracking-wider text-slate py-3 px-4">Company</th>
                  <th className="text-left text-xs font-medium uppercase tracking-wider text-slate py-3 px-4">Signal</th>
                  <th className="text-left text-xs font-medium uppercase tracking-wider text-slate py-3 px-4">Count</th>
                </tr>
              </thead>
              <tbody>
                {data.spam_signals.map((s) => (
                  <tr key={s.participant_id} className="border-b border-slate/10">
                    <td className="py-3 px-4 font-medium text-charcoal">{s.name}</td>
                    <td className="py-3 px-4"><StatusBadge status="warning" /></td>
                    <td className="py-3 px-4 text-slate">{s.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Trust Anomalies">
        {!data ? (
          <p className="text-sm text-slate text-center py-8">Trust anomalies could not be loaded.</p>
        ) : data.trust_anomalies.length === 0 ? (
          <p className="text-sm text-slate text-center py-8">No trust anomalies detected.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate/15">
                  <th className="text-left text-xs font-medium uppercase tracking-wider text-slate py-3 px-4">Company</th>
                  <th className="text-left text-xs font-medium uppercase tracking-wider text-slate py-3 px-4">Anomaly</th>
                </tr>
              </thead>
              <tbody>
                {data.trust_anomalies.map((a) => (
                  <tr key={a.participant_id} className="border-b border-slate/10">
                    <td className="py-3 px-4 font-medium text-charcoal">{a.name}</td>
                    <td className="py-3 px-4 text-slate">{a.anomaly}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
