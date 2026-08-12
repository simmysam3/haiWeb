import Link from "next/link";

interface DashboardAlertBarProps {
  /**
   * Fleet counts. `jailed` is haiCore's own agent status — the state its
   * heartbeat machine moves an agent into after 3 consecutive failed probes,
   * and recovers from through `probation`. Using it rather than a freshness
   * window defined here means this alert agrees with the Agents page and with
   * the state machine that owns the question. `jailedNames` are haiCore's own
   * agent names, with id-slice fallback resolved by the caller. `null` = not known.
   */
  agents: { total: number; jailed: number; jailedNames: string[] } | null;
  /** The account's own participant status. `null` = not known. */
  accountStatus: string | null;
}

type Severity = "blocking" | "degraded";

interface Alert {
  severity: Severity;
  headline: string;
  detail: string;
  href?: string;
  hrefLabel?: string;
}

/** Blocking reads before degraded: one stops you trading, the other slows you. */
const SEVERITY_ORDER: Record<Severity, number> = { blocking: 0, degraded: 1 };

const SEVERITY_STYLE: Record<Severity, string> = {
  blocking: "border-problem/20 bg-problem/5 text-problem",
  degraded: "border-warning/30 bg-warning/10 text-navy",
};

/** "Arno, Mekong" or "Arno, Mekong +2 more" — two names, then a count. */
function nameList(names: string[]): string {
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
}

/**
 * Interrupt bar for the System Dashboard.
 *
 * Renders only when something is actually wrong — no container, no "all clear"
 * row, nothing. Its presence on the page IS the signal, which only works if it
 * is absent the rest of the time.
 *
 * A `null` input means "we could not find out" and never raises an alert.
 * haiCore being unreachable must not masquerade as the account being suspended
 * or the fleet being down; both of those are specific accusations, and making
 * one falsely is worse than staying quiet.
 */
export function DashboardAlertBar({ agents, accountStatus }: DashboardAlertBarProps) {
  const alerts: Alert[] = [];

  if (accountStatus === "suspended") {
    alerts.push({
      severity: "blocking",
      headline: "Account suspended",
      detail:
        "This account cannot trade on the network. Contact HAIWAVE support to restore it.",
    });
  }

  // Only a JAILED agent is a fault. An account with no agents at all is mid
  // setup, not broken, and interrupting it would be noise — which is why this
  // keys off `jailed` rather than "nothing is active".
  if (agents && agents.jailed > 0) {
    const everyAgent = agents.jailed === agents.total;
    const names = nameList(agents.jailedNames);
    alerts.push(
      everyAgent
        ? {
            severity: "blocking",
            headline: "No agents are reachable",
            detail: `Every agent has stopped answering heartbeats (${names}), so no inbound quote request can be answered.`,
            href: "/account/agents",
            hrefLabel: "Check agent health under Agents.",
          }
        : {
            severity: "degraded",
            headline: `${agents.jailed} of ${agents.total} agents unreachable`,
            detail: `Unreachable: ${names}. A jailed agent returns to service automatically once it answers heartbeats again.`,
            href: "/account/agents",
            hrefLabel: "Check agent health under Agents.",
          },
    );
  }

  if (alerts.length === 0) return null;

  alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  return (
    <div role="alert" className="mb-8 flex flex-col gap-3">
      {alerts.map((alert) => (
        <div
          key={alert.headline}
          className={`rounded-lg border px-4 py-3 text-sm ${SEVERITY_STYLE[alert.severity]}`}
        >
          <span className="font-semibold">{alert.headline}</span>
          <span className="ml-2 text-slate">{alert.detail}</span>
          {alert.href && (
            <Link href={alert.href} className="ml-2 underline decoration-dotted hover:decoration-solid">
              {alert.hrefLabel}
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
