import { PageHeader } from "@/components/page-header";
import { ProvenanceDashboard } from "./provenance-dashboard";

export default function ProvenancePage() {
  return (
    <div>
      <PageHeader
        title="Provenance"
        description="Origin manifests and certification status"
      />
      <ProvenanceDashboard />
    </div>
  );
}
