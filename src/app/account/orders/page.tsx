import { PageHeader } from "@/components/page-header";
import { OrdersDashboard } from "./orders-dashboard";

export default function OrdersPage() {
  return (
    <div>
      <PageHeader
        title="Orders"
        description="Track buy-side purchases and manage sell-side fulfillment orders."
      />
      <OrdersDashboard />
    </div>
  );
}
