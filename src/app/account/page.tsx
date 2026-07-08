import { StatCard } from "@/components/stat-card";
import { Card } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { PageIntro } from "@/components/page-intro";
import { NotificationsPanel } from "./_components/notifications-panel";
import { fetchFromApi } from "@/lib/server-haiwave-client";
import { getSession } from "@/lib/auth";

/** Placeholder shown in a card body when its data source is not yet wired. */
function NotAvailable() {
  return <p className="text-sm text-slate/60">Not Available</p>;
}

export default async function DashboardPage() {
  const session = await getSession();

  // Composite behavioral score from haiCore. No real score → null (the tile
  // renders "Not Available") rather than a fabricated placeholder number.
  const scoreData: number | null = session
    ? await fetchFromApi(
        async (client) => {
          const result = (await client.getScore(session.participant.id)) as {
            composite_score?: number;
            composite?: number;
          } | null;
          return result?.composite_score ?? result?.composite ?? null;
        },
        null,
      )
    : null;

  return (
    <div>
      <PageHeader
        title="System Dashboard"
        description="Account overview, agent status, and pending actions."
      />
      <PageIntro>
        Your at-a-glance view of inbound activity across the HAIWAVE network — recent orders, behavioral signals, compliance flags, and agent health. Use it to triage anomalies and drop into the section that owns the decision (Compliance, Behavioral Scores, Provenance, Agent Health) when something needs attention.
      </PageIntro>

      {/* Row 1: Stat Cards. Values with no real data source render "Not
          Available" (pass null) rather than fabricated numbers. */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <StatCard label="Account Status" value={null} />
        <StatCard label="Trading Pairs" value={null} />
        <StatCard label="Agents Online" value={null} />
        <StatCard
          label="Behavioral Score"
          value={scoreData != null ? `${scoreData}%` : null}
          color={scoreData != null && scoreData >= 90 ? "text-success" : "text-teal"}
        />
      </div>

      {/* Row 2: Pending & Billing */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <Card title="Pending Requests">
          <NotAvailable />
        </Card>

        <Card title="Upcoming Billing">
          <NotAvailable />
        </Card>
      </div>

      {/* Row 3: Notifications */}
      <div className="mb-8">
        <NotificationsPanel />
      </div>

      {/* Row 4: Agent Overview */}
      <Card title="Agent Overview">
        <NotAvailable />
      </Card>
    </div>
  );
}
