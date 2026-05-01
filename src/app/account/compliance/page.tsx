import { PageHeader } from "@/components/page-header";
import { PageIntro } from "@/components/page-intro";
import { ComplianceDashboard } from "./compliance-dashboard";

export default function CompliancePage() {
  return (
    <div>
      <PageHeader
        title="Compliance"
        description="Noncompliance flags and self-audit reports"
      />
      <PageIntro>
        Noncompliance flags and self-audit reports your agent has surfaced from inbound activity, ranked by severity. Investigate the underlying transactions and clear flags with resolution notes once an issue is addressed. Rows with reason <span className="font-mono text-xs">vendor_not_on_network</span> mark upstream gaps where the supplier hasn&apos;t joined HAIWAVE — the vendor is shown as &quot;Unknown&quot; by design; the product column shows your own SKU so you know which item to act on.
      </PageIntro>
      <ComplianceDashboard />
    </div>
  );
}
