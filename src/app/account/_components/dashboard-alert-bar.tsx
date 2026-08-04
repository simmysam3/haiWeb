interface DashboardAlertBarProps {
  /** Count of agents whose haiCore status is `active`. `null` = not known. */
  agentsOnline: number | null;
  /** The account's own participant status. `null` = not known. */
  accountStatus: string | null;
}

type Severity = "blocking" | "degraded";

interface Alert {
  severity: Severity;
  headline: string;
  detail: string;
}

/** Blocking reads before degraded: one stops you trading, the other slows you. */
const SEVERITY_ORDER: Record<Severity, number> = { blocking: 0, degraded: 1 };

const SEVERITY_STYLE: Record<Severity, string> = {
  blocking: "border-problem/20 bg-problem/5 text-problem",
  degraded: "border-warning/30 bg-warning/10 text-navy",
};

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
export function DashboardAlertBar({ agentsOnline, accountStatus }: DashboardAlertBarProps) {
  const alerts: Alert[] = [];

  if (accountStatus === "suspended") {
    alerts.push({
      severity: "blocking",
      headline: "Account suspended",
      detail:
        "This account cannot trade on the network. Contact HAIWAVE support to restore it.",
    });
  }

  if (agentsOnline === 0) {
    alerts.push({
      severity: "degraded",
      headline: "No agents online",
      detail:
        "Inbound quote requests cannot be answered while every agent is offline. Check agent health under Agent Management.",
    });
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
        </div>
      ))}
    </div>
  );
}
