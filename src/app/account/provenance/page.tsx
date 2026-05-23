import { PageHeader } from "@/components/page-header";
import { PageIntro } from "@/components/page-intro";
import { ProvenanceDashboard } from "./provenance-dashboard";

export default function ProvenancePage() {
  return (
    <div>
      <PageHeader
        title="Product Provenance"
        description="Product-led composition view across your supply chain."
      />
      <PageIntro>
        Inspect what makes up your products. Start at any product you sell and walk down its supply chain — components, subcomponents, manufacturing facilities, country-of-origin, and certifications at every layer. Read-only browse of manifests already declared into your network — the steady-state companion to Audits&apos; active verification.
      </PageIntro>
      <ProvenanceDashboard />
    </div>
  );
}
