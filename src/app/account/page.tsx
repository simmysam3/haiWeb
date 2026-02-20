import Link from "next/link";
import { StatCard } from "@/components/stat-card";
import { Card } from "@/components/card";
import { StatusBadge } from "@/components/status-badge";
import { fetchFromApi } from "@/lib/fetch-api";
import { getSession } from "@/lib/auth";
import {
  MOCK_AGENTS,
  MOCK_ACCESS_REQUESTS,
  MOCK_INVOICES,
  MOCK_PARTNERS,
  MOCK_SCORE_COMPOSITE,
} from "@/lib/mock-data";

export default async function DashboardPage() {
  const session = await getSession();

  // Fetch composite behavioral score from haiCore, falling back to mock data
  const scoreData = session
    ? await fetchFromApi(
        async (client) => {
          const result = (await client.getScore(session.participant.id)) as {
            composite_score?: number;
            composite?: number;
          } | null;
          return result?.composite_score ?? result?.composite ?? MOCK_SCORE_COMPOSITE;
        },
        MOCK_SCORE_COMPOSITE,
      )
    : MOCK_SCORE_COMPOSITE;

  const agentsOnline = MOCK_AGENTS.filter((a) => a.status === "active").length;
  const pendingInvoice = MOCK_INVOICES.find((i) => i.status === "open");

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-navy mb-2">
        Dashboard
      </h1>
      <p className="text-slate mb-8">
        Account overview, agent status, and pending actions.
      </p>

      {/* Row 1: Stat Cards */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <StatCard label="Account Status" value="Active" color="text-success" />
        <StatCard
          label="Trading Pairs"
          value={`${MOCK_PARTNERS.filter((p) => p.status === "trading_pair").length} pairs`}
          trend={8}
        />
        <StatCard
          label="Agents Online"
          value={`${agentsOnline} / ${MOCK_AGENTS.length}`}
          color="text-navy"
        />
        <StatCard
          label="Behavioral Score"
          value={`${scoreData}%`}
          trend={2}
          color={scoreData >= 90 ? "text-success" : "text-teal"}
        />
      </div>

      {/* Row 2: Pending & Billing */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <Card title="Pending Requests">
          {MOCK_ACCESS_REQUESTS.length === 0 ? (
            <p className="text-sm text-slate">No pending requests.</p>
          ) : (
            <div className="space-y-3">
              {MOCK_ACCESS_REQUESTS.slice(0, 3).map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between py-2 border-b border-slate/10 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-charcoal">
                      {req.company_name}
                    </p>
                    <p className="text-xs text-slate">{req.industry}</p>
                  </div>
                  <p className="text-xs text-slate">
                    {new Date(req.requested_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
              <Link
                href="/account/partners"
                className="block text-sm text-teal-dark hover:underline pt-1"
              >
                View all requests
              </Link>
            </div>
          )}
        </Card>

        <Card title="Upcoming Billing">
          {pendingInvoice ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-charcoal">
                  {pendingInvoice.description}
                </p>
                <StatusBadge status={pendingInvoice.status} />
              </div>
              <p className="text-2xl font-bold text-navy">
                ${pendingInvoice.amount.toLocaleString()}
              </p>
              <p className="text-xs text-slate mt-1">
                Due {pendingInvoice.date}
              </p>
              <Link
                href="/account/billing"
                className="block text-sm text-teal-dark hover:underline mt-3"
              >
                View billing details
              </Link>
            </div>
          ) : (
            <p className="text-sm text-slate">No upcoming invoices.</p>
          )}
        </Card>
      </div>

      {/* Row 3: Agent Overview */}
      <Card title="Agent Overview">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate/15">
                <th className="text-left text-xs font-medium uppercase tracking-wider text-slate py-3 px-4">
                  Agent ID
                </th>
                <th className="text-left text-xs font-medium uppercase tracking-wider text-slate py-3 px-4">
                  Status
                </th>
                <th className="text-left text-xs font-medium uppercase tracking-wider text-slate py-3 px-4">
                  Last Heartbeat
                </th>
                <th className="text-left text-xs font-medium uppercase tracking-wider text-slate py-3 px-4">
                  Active Types
                </th>
              </tr>
            </thead>
            <tbody>
              {MOCK_AGENTS.map((agent) => (
                <tr
                  key={agent.id}
                  className="border-b border-slate/10 hover:bg-light-gray/50"
                >
                  <td className="py-3 px-4 font-mono text-xs">
                    {agent.id.slice(0, 12)}...
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={agent.status} />
                  </td>
                  <td className="py-3 px-4 text-slate">
                    {new Date(agent.last_heartbeat).toLocaleString()}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1">
                      {agent.types
                        .filter((t) => t.enabled)
                        .map((t) => (
                          <span
                            key={t.key}
                            className="px-2 py-0.5 text-xs bg-teal/10 text-teal-dark rounded"
                          >
                            {t.label}
                          </span>
                        ))}
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
