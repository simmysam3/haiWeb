import { PageHeader } from "@/components/page-header";
import { AgentsPanel } from "./agents-panel";

export default function AgentsPage() {
  return (
    <div>
      <PageHeader
        title="Agents"
        description="Provision HAIWAVE agent deployments and manage their keys. Runtime health lives under Monitoring → Agent Health."
      />
      <AgentsPanel />
    </div>
  );
}
