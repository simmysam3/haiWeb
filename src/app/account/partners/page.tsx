import { PageHeader } from "@/components/page-header";
import { PageIntro } from "@/components/page-intro";
import { PartnersPanel } from "./partners-panel";

export default function PartnersPage() {
  return (
    <div>
      <PageHeader
        title="Trading Partners"
        description="Discover companies, manage connections, and track partnership status."
      />
      <PageIntro>
        Find other companies on HAIWAVE, manage your active trading connections, and review pending invitations. Connect with new partners, adjust permission scopes, or move misbehaving counterparties to your block list — which lives one level below this page.
      </PageIntro>
      <PartnersPanel />
    </div>
  );
}
