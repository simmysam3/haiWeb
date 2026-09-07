"use client";

import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/card";
import { StatCard } from "@/components/stat-card";
import { useApi } from "@/lib/use-api";

interface ConnectionAnalytics {
  approval_rate_30d: number;
  mean_time_to_approve_hours: number;
  auto_approval_rate: number;
  requests_30d: number;
  top_requesters: { participant_id: string; name: string; request_count: number }[];
}

export default function AnalyticsPage() {
  // Absence surfaces as absence (admin-dashboard.tsx): no seeded rates or
  // requesters; a failed read is a visible notice and the tiles show
  // "Not Available" (SEC-web-admin-ops-1-05).
  const { data, error } = useApi<ConnectionAnalytics | null>({
    url: "/api/admin/dashboard?type=connections",
    fallback: null,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Connection Analytics"
        description="Track connection formation patterns and approval velocity."
      />

      {error && (
        <div role="alert" className="bg-problem/5 border border-problem/20 rounded-lg px-4 py-3 text-sm text-problem">
          Couldn&apos;t load connection analytics — haiCore answered {error}. Tiles show absence rather than stale or fabricated numbers.
        </div>
      )}
      <div className="grid grid-cols-4 gap-6">
        <StatCard label="Requests (30d)" value={data ? data.requests_30d.toString() : null} color="text-navy" />
        <StatCard label="Approval Rate" value={data ? `${data.approval_rate_30d.toFixed(1)}%` : null} color="text-success" />
        <StatCard label="Avg. Approval Time" value={data ? `${data.mean_time_to_approve_hours.toFixed(1)}h` : null} color="text-navy" />
        <StatCard label="Auto-Approval Rate" value={data ? `${data.auto_approval_rate.toFixed(1)}%` : null} color="text-teal" />
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
              {(data?.top_requesters ?? []).map((r) => (
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
