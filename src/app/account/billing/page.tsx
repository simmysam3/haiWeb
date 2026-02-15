import { getSession, hasRole } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { BillingPanel } from "./billing-panel";
import { redirect } from "next/navigation";

export default async function BillingPage() {
  const session = await getSession();
  if (!session || !hasRole(session.user.role, "account_owner")) {
    redirect("/account");
  }

  return (
    <div>
      <PageHeader
        title="Billing"
        description="Subscription, payment methods, and invoice history."
      />
      <BillingPanel />
    </div>
  );
}
