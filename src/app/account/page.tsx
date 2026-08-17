import { StatCard } from "@/components/stat-card";
import { Card } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { PageIntro } from "@/components/page-intro";
import { NotificationsPanel } from "./_components/notifications-panel";
import { QuoteVolumePanel } from "./_components/quote-volume-panel";
import { DashboardAlertBar } from "./_components/dashboard-alert-bar";
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

  // Both connection counts come from ONE call. `total` is every active
  // connection; `pairs` is the subset that reached `trading_pair`, the state in
  // which the two sides actually transact — the rest are `approved`, which is
  // an introduction rather than a trading relationship. Splitting this into two
  // lanes would be a second round trip for a number already in hand.
  const connections: { total: number; pairs: number } | null = session
    ? await fetchFromApi(async (client) => {
        const rows = (await client.listActiveConnections()) as unknown as Array<{
          relationship_state?: string;
        }>;
        return {
          total: rows.length,
          pairs: rows.filter((c) => c.relationship_state === "trading_pair").length,
        };
      }, null)
    : null;

  // One call, both fleet numbers (broker P3, §6.6): `healthy` drives the
  // "Agents Online" tile — administrative `active` status says nothing about
  // whether an agent is actually answering, so counting it was a standing
  // false "online" claim — and `unreachable` drives the alert, both from
  // haiCore's DERIVED per-agent availability (unresolved dispatch failures /
  // stale liveness), which self-clears on the recovery edge. The alert
  // deliberately keys off unreachable rather than "healthy === 0": an account
  // that has provisioned no agents yet is in setup, not in fault, and the two
  // are indistinguishable by a zero count.
  const fleet: { total: number; healthy: number; unreachable: number; unreachableNames: string[] } | null = session
    ? await fetchFromApi(async (client) => {
        const { agents } = await client.listAgents();
        return {
          total: agents.length,
          healthy: agents.filter((a) => a.availability === "healthy").length,
          unreachable: agents.filter((a) => a.availability === "unreachable").length,
          unreachableNames: agents
            .filter((a) => a.availability === "unreachable")
            .map((a) => a.name ?? a.id.slice(0, 8)),
        };
      }, null)
    : null;

  // The account's own standing. haiCore's `GET /participants/me` (v1.66) is the
  // only reader for this: the public company profile omits status by design,
  // and the admin surface is not callable by the account itself. Without it a
  // suspended account saw a normal dashboard and no explanation.
  const accountStatus: string | null = session
    ? await fetchFromApi(async (client) => {
        const self = await client.getSelfParticipant();
        return self.status;
      }, null)
    : null;

  return (
    <div>
      <PageHeader
        title="System Dashboard"
        description="Account overview, agent status, and pending actions."
      />
      <PageIntro>
        Your at-a-glance view of inbound activity across the HAIWAVE network — quote volume, behavioral signals, compliance flags, and agent health. Use it to triage anomalies and drop into the section that owns the decision (Compliance, Behavioral Scores, Provenance, Agent Health) when something needs attention.
      </PageIntro>

      {/* Interrupts, above everything. Absent whenever nothing is wrong —
          which is what makes its presence meaningful. Note this reads the
          status from haiCore, NOT `session.participant.status`, which is the
          literal "active" hard-coded in auth.ts:145 and would report every
          account healthy including a suspended one. */}
      <DashboardAlertBar
        agents={fleet && { total: fleet.total, unreachable: fleet.unreachable, unreachableNames: fleet.unreachableNames }}
        accountStatus={accountStatus}
      />

      {/* The event inbox, directly under the interrupts. These are two
          different jobs: the bar above is live derived state that clears
          itself when the condition resolves; this is a list of things that
          happened, which you read and mark off. It sat at the foot of the page
          under billing, where nobody scrolled to it. */}
      <div className="mb-8">
        <NotificationsPanel />
      </div>

      {/* Row 1: Stat Cards. Values with no real data source render "Not
          Available" (pass null) rather than fabricated numbers. */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <StatCard
          label="Total Connections"
          value={connections != null ? String(connections.total) : null}
        />
        <StatCard
          label="Trading Pairs"
          value={connections != null ? String(connections.pairs) : null}
        />
        {/* P7d (ruled): the label stays, the value is the HEALTHY count —
            an agent is "online" when it is actually answering, not when its
            administrative status happens to be 'active'. */}
        <StatCard
          label="Agents Online"
          value={fleet != null ? String(fleet.healthy) : null}
        />
        <StatCard
          label="Behavioral Score"
          value={scoreData != null ? `${scoreData}%` : null}
          color={scoreData != null && scoreData >= 90 ? "text-success" : "text-teal"}
        />
      </div>

      <QuoteVolumePanel />

      {/* Row 2: Pending & Billing */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <Card title="Pending Requests">
          <NotAvailable />
        </Card>

        <Card title="Upcoming Billing">
          <NotAvailable />
        </Card>
      </div>

      {/* Agent Overview */}
      <Card title="Agent Overview">
        <NotAvailable />
      </Card>
    </div>
  );
}
