import { getSession, hasRole } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const session = await getSession();
  const readOnly = !session || !hasRole(session.user.role, "account_admin");

  return (
    <div>
      <PageHeader
        title="Company Profile"
        description="Manage your company information visible on the HAIWAVE network."
      />
      {readOnly && (
        <div className="bg-warning/5 border border-warning/20 rounded-lg px-4 py-3 text-sm text-warning mb-6">
          You have read-only access. Contact your account owner to make changes.
        </div>
      )}
      <ProfileForm readOnly={readOnly} />
    </div>
  );
}
