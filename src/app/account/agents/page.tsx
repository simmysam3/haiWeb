import { PageHeader } from "@/components/page-header";
import { AgentsPanel } from "./agents-panel";

export default function AgentsPage() {
  return (
    <div>
      <PageHeader
        title="Agents"
        description="Provision and monitor your HAIWAVE agent deployments."
      />
      <AgentsPanel />
    </div>
  );
}
