import { PageHeader } from "@/components/page-header";
import { PageIntro } from "@/components/page-intro";
import { ProvenanceDashboard } from "./provenance-dashboard";

export default function ProvenancePage() {
  return (
    <div>
      <PageHeader
        title="Product Provenance"
        description="Origin manifests and certifications for your products"
      />
      <PageIntro>
        Start with one of your products and drill into the component makeup behind it — facilities, subcomponents, country-of-origin, and the regulatory certifications attached. Product-led companion to Audits: where Audits actively verify a supplier&apos;s claims, this surfaces the manifests already declared and published into your network.
      </PageIntro>
      <ProvenanceDashboard />
    </div>
  );
}
