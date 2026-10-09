import { getSession, canAdministerAccount } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { UsersTable } from "./users-table";
import { redirect } from "next/navigation";

export default async function UsersPage() {
  const session = await getSession();
  if (!session || !canAdministerAccount(session.user.role)) {
    redirect("/account");
  }

  return (
    <div>
      <PageHeader
        title="Users"
        description="Manage team members with access to this account."
      />
      <UsersTable />
    </div>
  );
}
