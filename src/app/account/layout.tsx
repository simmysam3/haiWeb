import { getSession } from "@/lib/auth";
import { AccountNav } from "@/components/account-nav";
import { ThrottleHeaderIndicator } from "@/components/throttle-header-indicator";
import { GlobalSearch } from "@/components/global-search";

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
    <div className="min-h-screen flex flex-col">
      <ThrottleHeaderIndicator />
      <div className="flex flex-1">
        <AccountNav userName={userName} userEmail={userEmail} />
        <main className="flex-1 bg-light-gray flex flex-col">
          {/*
           * v1.37 Unified Global Search — always-visible top header above the
           * main content area. Width matches main's max-width container so
           * the input lines up with page content. Placed above (not inside)
           * the per-page max-w container so it stretches across the full
           * main column even when the page content is narrower.
           */}
          <div className="border-b border-slate/10 bg-white px-8 py-3">
            <div className="max-w-[1200px] mx-auto flex justify-end">
              <GlobalSearch />
            </div>
          </div>
          <div className="max-w-[1200px] mx-auto p-8 w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
