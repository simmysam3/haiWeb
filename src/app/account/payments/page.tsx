import { PageHeader } from "@/components/page-header";
import { PageIntro } from "@/components/page-intro";
import { PaymentsDashboard } from "./payments-dashboard";

export default function PaymentsPage() {
  return (
    <div>
      <PageHeader
        title="Payments"
        description="Manage your USDC wallet, spending policies, payment manifests, and transaction history."
      />
      <PageIntro>
        Manage the USDC wallet your agent settles network transactions from, the spending policies that limit autonomous outflows, payment manifests, and the full settlement history. Use it to fund the wallet, approve held payments, and review what your agent has paid out on your behalf.
      </PageIntro>
      <PaymentsDashboard />
    </div>
  );
}
