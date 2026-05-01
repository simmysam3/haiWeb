import { PageHeader } from "@/components/page-header";
import { PageIntro } from "@/components/page-intro";
import { OrdersDashboard } from "./orders-dashboard";

export default function OrdersPage() {
  return (
    <div>
      <PageHeader
        title="Orders"
        description="Track buy-side purchases and manage sell-side fulfillment orders."
      />
      <PageIntro>
        Every order your agent has placed with suppliers (buy-side) and received from customers (sell-side), in one timeline. Drill into individual orders to inspect status, line-item provenance, and any exceptions that need human review before settlement.
      </PageIntro>
      <OrdersDashboard />
    </div>
  );
}
