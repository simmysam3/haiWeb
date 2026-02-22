import { PageHeader } from "@/components/page-header";
import { PaymentsDashboard } from "./payments-dashboard";

export default function PaymentsPage() {
  return (
    <div>
      <PageHeader
        title="Payments"
        description="Manage your USDC wallet, spending policies, payment manifests, and transaction history."
      />
      <PaymentsDashboard />
    </div>
  );
}
