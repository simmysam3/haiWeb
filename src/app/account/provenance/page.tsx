import { PageHeader } from "@/components/page-header";
import { PageIntro } from "@/components/page-intro";
import { ProvenanceDashboard } from "./provenance-dashboard";

export default function ProvenancePage() {
  return (
    <div>
      <PageHeader
        title="Provenance"
        description="Origin manifests and certification status"
      />
      <PageIntro>
        Inspect the origin manifests and certifications attached to goods flowing through your network — both what your suppliers have published to you and what you&apos;ve published downstream. Use it to verify country-of-origin claims, regulatory certifications, and component lineage on any SKU at any time.
      </PageIntro>
      <ProvenanceDashboard />
    </div>
  );
}
