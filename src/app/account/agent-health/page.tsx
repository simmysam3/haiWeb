import { PageHeader } from "@/components/page-header";
import { PageIntro } from "@/components/page-intro";
import { AgentHealthPanel } from "./agent-health-panel";

export default function AgentHealthPage() {
  return (
    <div>
      <PageHeader
        title="Agent Health"
        description="Monitor heartbeat, status, and failure counts across your deployed agents."
      />
      <PageIntro>
        Real-time runtime status for the agent processes you&apos;ve deployed — heartbeat, last-seen timestamp, failure counts, and version. Use it to confirm agents are reachable, restart misbehaving deployments, and triage uptime separately from the provisioning workflows in <em>Account Management → Agents</em>.
      </PageIntro>
      <AgentHealthPanel />
    </div>
  );
}
