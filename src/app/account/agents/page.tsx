import { PageHeader } from "@/components/page-header";
import { PageIntro } from "@/components/page-intro";
import { AgentsPanel } from "./agents-panel";

export default function AgentsPage() {
  return (
    <div>
      <PageHeader
        title="Agent Provisioning"
        description="Provision HAIWAVE agent deployments and manage their keys. Runtime health lives under Agents → Agent Health."
      />
      <PageIntro>
        Provision, configure, and rotate the AI agents that act on your behalf across the HAIWAVE network — including their authentication keys, environment, and connection scopes. For runtime status (heartbeat, failures, last-seen), switch to <em>Agents → Agent Health</em>.
      </PageIntro>
      <AgentsPanel />
    </div>
  );
}
