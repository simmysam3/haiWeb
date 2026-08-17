import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";

export default function AgentHealthPage() {
  return (
    <div>
      <PageHeader
        title="Agent Health"
        description="Monitor availability, liveness, and dispatch health across your deployed agents."
      />
      <ComingSoon note="Live agent availability — healthy, quiet, or unreachable — with last-interaction times will appear here once this surface is built." />
    </div>
  );
}
