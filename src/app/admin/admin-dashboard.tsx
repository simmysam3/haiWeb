"use client";

import Link from "next/link";
import { StatCard } from "@/components/stat-card";
import { Card } from "@/components/card";
import { StatusBadge } from "@/components/status-badge";
import { useApi } from "@/lib/use-api";
import {
  participantLocation,
  type AdminParticipantsList,
} from "@/lib/admin-participants-types";

/**
 * The REAL haiCore AdminOverview payload (protocol AdminOverviewSchema). The
 * previous local interface here described a fictional
 * `agent_health{…,offline}` shape haiCore never returned — the real payload
 * threw on first read and this page silently showed its mock forever.
 * `availability` is the broker-P3 derived split (additive; absent from an
 * older haiCore).
 */
interface AdminOverview {
  participants: { total: number; active: number; suspended: number; pending: number };
  trading_pairs: { total: number; active_30d: number };
  agents: {
    total: number;
    active: number;
    jailed: number;
    probation: number;
    revoked?: number;
    availability?: { healthy: number; quiet: number; unreachable: number; not_deployed: number };
  };
  gofish: { queries_24h: number; queries_7d: number };
  orders: { total: number; open: number };
}

export function AdminDashboard() {
  // v1.75 walk W3 / F-4 residue: the fallback used to be MOCK_ADMIN_STATS, so
  // an API failure silently rendered mock numbers. Absence surfaces as
  // absence: null data + a visible notice, never a fabricated dashboard.
  const { data: stats, error: statsError } = useApi<AdminOverview | null>({
    url: "/api/admin/dashboard?type=overview",
    fallback: null,
  });
  const { data: list, error: listError } = useApi<AdminParticipantsList | null>({
    url: "/api/admin/participants",
    fallback: null,
  });

  // The server orders newest-first (listParticipants ORDER BY registered_at
  // DESC) — the first five ARE the recent registrations.
  const recentRegistrations = (list?.participants ?? []).slice(0, 5);
  const suspended = (list?.participants ?? []).filter((p) => p.status === "suspended");

  // P7c (ruled): Healthy / Quiet / Unreachable / Suspended. The first three
  // are the DERIVED availability of deployed active agents; Suspended is the
  // administrative jailed count (P3: status is a decision, not a
  // measurement). not_deployed agents are in setup, not in fault — outside
  // the tile denominator.
  const avail = stats?.agents.availability ?? null;
  const deployedTotal = avail ? avail.healthy + avail.quiet + avail.unreachable : null;
  const healthSegments = avail && stats
    ? [
        { label: "Healthy", count: avail.healthy, color: "bg-success" },
        { label: "Quiet", count: avail.quiet, color: "bg-warning" },
        { label: "Unreachable", count: avail.unreachable, color: "bg-problem" },
        { label: "Suspended", count: stats.agents.jailed, color: "bg-slate/30" },
      ]
    : [];
  const segmentTotal = healthSegments.reduce((n, s) => n + s.count, 0);

  return (
    <div className="space-y-8">
      {statsError && (
        <div className="bg-problem/5 border border-problem/20 rounded-lg px-4 py-3 text-sm text-problem">
          Couldn&apos;t load network stats — haiCore answered {statsError}. Tiles show absence
          rather than stale or fabricated numbers.
        </div>
      )}
      {listError && (
        <div className="bg-problem/5 border border-problem/20 rounded-lg px-4 py-3 text-sm text-problem">
          Couldn&apos;t load participants — haiCore answered {listError}.
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-6">
        <StatCard
          label="Participants"
          value={stats ? stats.participants.total.toString() : null}
          color="text-navy"
        />
        <StatCard
          label="Trading Pairs"
          value={stats ? stats.trading_pairs.total.toString() : null}
          color="text-navy"
        />
        {/* No real data source (the invoice lane never shipped a dashboard
            field) — absence surfaces as absence, never a fabricated number. */}
        <StatCard
          label="Outstanding Invoices"
          value={null}
          color="text-warning"
        />
        <StatCard
          label="Agent Health"
          value={avail && deployedTotal != null ? `${avail.healthy}/${deployedTotal} healthy` : null}
          color={avail && avail.unreachable > 0 ? "text-warning" : "text-success"}
        />
      </div>

      {/* Recent Registrations — the real list, newest first (v1.75 walk W3;
          was mock theater). */}
      <Card title="Recent Registrations">
        {recentRegistrations.length === 0 ? (
          <p className="text-sm text-slate text-center py-4">
            {listError ? "Not available." : "No registrations yet."}
          </p>
        ) : (
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
                  <tr key={p.participant_id} className="border-b border-slate/10 hover:bg-light-gray/50">
                    <td className="py-3 px-4 font-medium text-charcoal">{p.legal_name}</td>
                    <td className="py-3 px-4 text-slate">{participantLocation(p)}</td>
                    <td className="py-3 px-4 text-slate">
                      {p.registered_at ? new Date(p.registered_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-3 px-4"><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Suspended Accounts — real rows; the mutation itself lives on the
          participants page (one modal, one audit-logged path), so this card
          links there instead of pretending to act (v1.75 walk W3). */}
      <Card title="Suspended Accounts">
        {suspended.length === 0 ? (
          <p className="text-sm text-slate text-center py-4">
            {listError ? "Not available." : "No suspended accounts."}
          </p>
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
                  <tr key={p.participant_id} className="border-b border-slate/10">
                    <td className="py-3 px-4 font-medium text-charcoal">{p.legal_name}</td>
                    <td className="py-3 px-4 text-slate">{p.suspension_reason ?? "—"}</td>
                    <td className="py-3 px-4">
                      <Link
                        href="/admin/participants"
                        className="text-sm font-medium text-teal hover:underline"
                      >
                        Manage →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Network Health — the derived availability split (P7c). Rendered
          only when haiCore serves the availability block: absence (an older
          haiCore) surfaces as absence, never as a row of zeros. */}
      {avail && segmentTotal > 0 && (
        <Card title="Network Health — Agent Availability Distribution">
          <div className="flex h-6 rounded-full overflow-hidden mb-4">
            {healthSegments.map((seg) => (
              seg.count > 0 && (
                <div
                  key={seg.label}
                  className={`${seg.color} transition-all`}
                  style={{ width: `${(seg.count / segmentTotal) * 100}%` }}
                  title={`${seg.label}: ${seg.count}`}
                />
              )
            ))}
          </div>
          <div className="flex gap-6">
            {healthSegments.map((seg) => (
              <div key={seg.label} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${seg.color}`} />
                <span className="text-xs text-slate">{seg.label}: {seg.count} ({Math.round((seg.count / segmentTotal) * 100)}%)</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
