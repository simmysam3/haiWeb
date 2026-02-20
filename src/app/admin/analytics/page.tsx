"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/card";
import { StatCard } from "@/components/stat-card";
import { TrendSparkline } from "@/components/trend-sparkline";

interface ConnectionAnalytics {
  approval_rate_30d: number;
  mean_time_to_approve_hours: number;
  auto_approval_rate: number;
  requests_30d: number;
  top_requesters: { participant_id: string; name: string; request_count: number }[];
}

const MOCK_ANALYTICS: ConnectionAnalytics = {
  approval_rate_30d: 78.5,
  mean_time_to_approve_hours: 4.2,
  auto_approval_rate: 62.3,
  requests_30d: 47,
  top_requesters: [
    { participant_id: "1", name: "National Industrial Supply", request_count: 8 },
    { participant_id: "2", name: "Pacific Coast Distributors", request_count: 6 },
    { participant_id: "3", name: "Great Lakes Supply Co.", request_count: 5 },
  ],
};

export default function AnalyticsPage() {
  const [data, setData] = useState<ConnectionAnalytics>(MOCK_ANALYTICS);

  useEffect(() => {
    fetch("/api/admin/dashboard?type=connections")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setData(d); })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Connection Analytics"
        description="Track connection formation patterns and approval velocity."
      />

      <div className="grid grid-cols-4 gap-6">
        <StatCard label="Requests (30d)" value={data.requests_30d.toString()} color="text-navy" />
        <StatCard label="Approval Rate" value={`${data.approval_rate_30d.toFixed(1)}%`} color="text-success" />
        <StatCard label="Avg. Approval Time" value={`${data.mean_time_to_approve_hours.toFixed(1)}h`} color="text-navy" />
        <StatCard label="Auto-Approval Rate" value={`${data.auto_approval_rate.toFixed(1)}%`} color="text-teal" />
      </div>

      <Card title="Top Requesters (30 days)">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate/15">
                <th className="text-left text-xs font-medium uppercase tracking-wider text-slate py-3 px-4">Company</th>
                <th className="text-left text-xs font-medium uppercase tracking-wider text-slate py-3 px-4">Requests</th>
                <th className="text-left text-xs font-medium uppercase tracking-wider text-slate py-3 px-4">Volume</th>
              </tr>
            </thead>
            <tbody>
              {data.top_requesters.map((r) => (
                <tr key={r.participant_id} className="border-b border-slate/10 hover:bg-light-gray/50">
                  <td className="py-3 px-4 font-medium text-charcoal">{r.name}</td>
                  <td className="py-3 px-4 text-slate">{r.request_count}</td>
                  <td className="py-3 px-4">
                    <div className="w-24 h-2 bg-slate/10 rounded-full overflow-hidden">
                      <div className="h-full bg-teal rounded-full" style={{ width: `${Math.min(100, (r.request_count / 10) * 100)}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
