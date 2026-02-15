import { PageHeader } from "@/components/page-header";
import { PartnersPanel } from "./partners-panel";

export default function PartnersPage() {
  return (
    <div>
      <PageHeader
        title="Trading Partners"
        description="Discover companies, manage connections, and track partnership status."
      />
      <PartnersPanel />
    </div>
  );
}
