"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/card";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";

interface AbuseMonitoring {
  active_blocks: number;
  blocks_30d: number;
  spam_signals: { participant_id: string; name: string; signal_type: string; count: number }[];
  trust_anomalies: { participant_id: string; name: string; anomaly: string }[];
}

const MOCK_ABUSE: AbuseMonitoring = {
  active_blocks: 3,
  blocks_30d: 2,
  spam_signals: [],
  trust_anomalies: [],
};

export default function AbusePage() {
  const [data, setData] = useState<AbuseMonitoring>(MOCK_ABUSE);

  useEffect(() => {
    fetch("/api/admin/dashboard?type=abuse")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setData(d); })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Ban & Abuse Monitoring"
        description="Detect abuse patterns and monitor block activity."
      />

      <div className="grid grid-cols-3 gap-6">
        <StatCard label="Active Blocks" value={data.active_blocks.toString()} color="text-problem" />
        <StatCard label="Blocks (30d)" value={data.blocks_30d.toString()} color="text-warning" />
        <StatCard label="Spam Signals" value={data.spam_signals.length.toString()} color={data.spam_signals.length > 0 ? "text-problem" : "text-success"} />
      </div>

      <Card title="High-Volume Connection Requests">
        {data.spam_signals.length === 0 ? (
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
        {data.trust_anomalies.length === 0 ? (
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
