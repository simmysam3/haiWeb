import { PageHeader } from "@/components/page-header";
import { SourceAuditDashboard } from "./source-audit-dashboard";

export default function SourceAuditPage() {
  return (
    <div>
      <PageHeader
        title="Source Audit"
        description="Trace supply chain provenance for any vendor product"
      />
      <SourceAuditDashboard />
    </div>
  );
}
