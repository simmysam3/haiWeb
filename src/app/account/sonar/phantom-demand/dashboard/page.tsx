import { PageHeader } from "@/components/page-header";
import { PhantomDemandDashboard } from "./phantom-demand-dashboard";

export default function PhantomDemandPage() {
  return (
    <div>
      <PageHeader
        title="Phantom Demand"
        description="Usage tracking and demand forecast analytics"
      />
      <PhantomDemandDashboard />
    </div>
  );
}
