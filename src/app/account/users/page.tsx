export default function UsersPage() {
  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-navy mb-2">
        Users
      </h1>
      <p className="text-slate mb-8">
        Manage team members with access to this account.
      </p>

      <div className="bg-white rounded-lg border border-slate/15 p-6">
        <p className="text-sm text-slate">
          User management: invite users, assign roles (account_owner,
          account_admin, account_viewer), deactivate accounts, view last login.
          Accessible to account_owner only.
        </p>
      </div>
    </div>
  );
}
