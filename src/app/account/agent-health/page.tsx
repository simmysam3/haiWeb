import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";

export default function AgentHealthPage() {
  return (
    <div>
      <PageHeader
        title="Agent Health"
        description="Monitor heartbeat, status, and failure counts across your deployed agents."
      />
      <ComingSoon note="Live agent heartbeat, last-seen, and failure metrics will appear here once runtime telemetry is wired." />
    </div>
  );
}
