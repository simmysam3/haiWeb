import { PageHeader } from "@/components/page-header";
import { ComplianceDashboard } from "./compliance-dashboard";

export default function CompliancePage() {
  return (
    <div>
      <PageHeader
        title="Compliance"
        description="Noncompliance flags and self-audit reports"
      />
      <ComplianceDashboard />
    </div>
  );
}
