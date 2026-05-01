import { PageHeader } from "@/components/page-header";
import { PageIntro } from "@/components/page-intro";
import { PhantomDemandDashboard } from "./phantom-demand-dashboard";

export default function PhantomDemandPage() {
  return (
    <div>
      <PageHeader
        title="Phantom Demand"
        description="Usage tracking and demand forecast analytics"
      />
      <PageIntro>
        Phantom demand is non-binding BOM-level inquiry — your agent asks the network &ldquo;can you fulfill X units of this part within Y days, and at what price?&rdquo; without placing an order. This dashboard surfaces exception trends, vendor responsiveness, and availability shifts across your bill of materials so procurement can act before a real order is at risk; for the formal output by window, see <em>Phantom Demand Reports</em>.
      </PageIntro>
      <PhantomDemandDashboard />
    </div>
  );
}
