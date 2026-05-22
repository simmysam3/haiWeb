"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Tab {
  segment: string;
  label: string;
  href: string;
  // The pure path (without query string) used for active-tab detection. For
  // tabs whose `href` includes a `?…`, this is the path prefix to match;
  // `pathname` from `usePathname()` carries no query string, so equality
  // against the full href would never hold.
  matchPath: string;
}

// v1.37 Request Management section nav — bilateral request inbox surfaces.
// The evidence legs (the "produce evidence" outcome and the responses list)
// were retired in v1.40: evidence is now authored via the v1.39 audit wizard
// at /account/sonar/audit/new and reviewed via the Audits history queue +
// run-detail page, so both the old "New response" draft tab and the
// "Responses" list tab were dropped from this nav.
const tabs: Tab[] = [
  {
    segment: "active",
    label: "Active queue",
    href: "/account/sonar/requests",
    matchPath: "/account/sonar/requests",
  },
  {
    segment: "declined",
    label: "Declined",
    href: "/account/sonar/requests/declined",
    matchPath: "/account/sonar/requests/declined",
  },
];

export function RequestManagementTabs({ hasScopes }: { hasScopes: boolean }) {
  const pathname = usePathname();

  return (
    <div className="flex border-b border-slate/15 mb-6">
      {tabs.map((tab) => {
        // Active-queue (the root /requests path) must NOT light up when the
        // user is on a deeper sibling — the prefix-startsWith fallback would
        // otherwise mark Active queue as active on /requests/declined, etc.
        // The other tabs are leaf paths so prefix-startsWith is fine.
        const isActive =
          tab.matchPath === "/account/sonar/requests"
            ? pathname === tab.matchPath
            : pathname === tab.matchPath || pathname.startsWith(`${tab.matchPath}/`);
        const showStartHere = !hasScopes && tab.segment === "active";
        return (
          <Link
            key={tab.segment}
            href={tab.href}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors inline-flex items-center gap-2 ${
              isActive
                ? "border-teal text-navy"
                : "border-transparent text-slate hover:text-charcoal"
            }`}
          >
            {tab.label}
            {showStartHere && (
              <span className="rounded-full bg-teal px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                Start here
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
