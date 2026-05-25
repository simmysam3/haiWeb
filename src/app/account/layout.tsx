import { getSession } from "@/lib/auth";
import { AccountNav } from "@/components/account-nav";
import { ThrottleHeaderIndicator } from "@/components/throttle-header-indicator";
import { GlobalSearch } from "@/components/global-search";
import { LastPathRecorder } from "@/components/last-path-recorder";

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
      <LastPathRecorder />
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
           *
           * v.1.37 mobile pass: tighter horizontal padding on phones so the
           * input has more room; main content padding likewise tightens.
           */}
          <div className="border-b border-slate/10 bg-white px-4 py-3 md:px-8">
            <div className="max-w-[1200px] mx-auto flex justify-end">
              <GlobalSearch />
            </div>
          </div>
          <div className="max-w-[1200px] mx-auto p-4 w-full md:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
