import { PageHeader } from "@/components/page-header";
import { PageIntro } from "@/components/page-intro";
import { AuditExceptionsDashboard } from "./audit-exceptions-dashboard";

export default function AuditExceptionsPage() {
  return (
    <div>
      <PageHeader
        title="Audit Exceptions"
        description="Rolled-up view of what needs attention across your audits and inbound activity."
      />
      <PageIntro>
        Triage exceptions in one place instead of drilling into each audit run.{' '}
        <strong>Run exceptions</strong> lists the latest non-compliant result per (vendor, product)
        across your last 7 days of audit runs. <strong>Incoming Activity Flags</strong> shows reactive
        alerts your agent surfaced from inbound activity — BOM-resolution gaps, missing manifests,
        and counterparties who aren&apos;t on HAIWAVE. Two channels, one inbox.
      </PageIntro>
      <AuditExceptionsDashboard />
    </div>
  );
}
