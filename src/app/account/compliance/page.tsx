import { PageHeader } from "@/components/page-header";
import { PageIntro } from "@/components/page-intro";
import { AuditExceptionsDashboard } from "./audit-exceptions-dashboard";

export default function AuditExceptionsPage() {
  return (
    <div>
      <PageHeader
        title="Audit Exceptions"
        description="The latest non-compliant result per (vendor, product) from your audit runs over the last 7 days."
      />
      <PageIntro>
        Triage non-compliant results in one place instead of drilling into each audit run.
        Rows are the latest <strong>non-compliant</strong> outcome per (vendor, product) across
        your last 7 days of audit runs.
      </PageIntro>
      <AuditExceptionsDashboard />
    </div>
  );
}
