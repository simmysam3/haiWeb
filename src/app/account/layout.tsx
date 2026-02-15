import { getSession } from "@/lib/auth";
import { AccountNav } from "@/components/account-nav";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const userName = session
    ? `${session.user.first_name} ${session.user.last_name}`
    : "User";
  const userEmail = session?.user.email ?? "";

  return (
    <div className="min-h-screen flex">
      <AccountNav userName={userName} userEmail={userEmail} />
      <main className="flex-1 bg-light-gray">
        <div className="max-w-[1200px] mx-auto p-8">{children}</div>
      </main>
    </div>
  );
}
