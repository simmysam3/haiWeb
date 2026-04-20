import { PageHeader } from "@/components/page-header";
import { AgentHealthPanel } from "./agent-health-panel";

export default function AgentHealthPage() {
  return (
    <div>
      <PageHeader
        title="Agent Health"
        description="Monitor heartbeat, status, and failure counts across your deployed agents."
      />
      <AgentHealthPanel />
    </div>
  );
}
