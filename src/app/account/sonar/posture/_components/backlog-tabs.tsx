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

// v1.37 Posture section nav — pure workflow surfaces. Coverage moved to
// /sonar/dashboard in the second v1.37 restructure; the section root
// /posture now lands on the Working List (its default landing) and the
// slim coverage-context strip in `layout.tsx` keeps coverage % visible
// above the tabs on every child page.
const tabs: Tab[] = [
  {
    segment: "working-list",
    label: "Working list",
    href: "/account/sonar/posture",
    matchPath: "/account/sonar/posture",
  },
  {
    segment: "changes",
    label: "Events",
    href: "/account/sonar/posture/changes",
    matchPath: "/account/sonar/posture/changes",
  },
  {
    segment: "obligations",
    label: "Obligations · Inbound",
    href: "/account/sonar/posture/obligations",
    matchPath: "/account/sonar/posture/obligations",
  },
  {
    segment: "runs",
    label: "Watchers",
    href: "/account/sonar/posture/runs",
    matchPath: "/account/sonar/posture/runs",
  },
];

export function PostureTabs({ hasScopes }: { hasScopes: boolean }) {
  const pathname = usePathname();

  return (
    <div className="flex border-b border-slate/15 mb-6">
      {tabs.map((tab) => {
        // The Working List landing (bare /posture path) must NOT light up
        // when the user is on a deeper sibling — prefix-startsWith would
        // otherwise mark it as active on /posture/changes, etc. The other
        // tabs are leaf paths so prefix-startsWith is fine and lets
        // sub-routes (e.g. /posture/changes/:id) keep the parent tab
        // highlighted. Also treat the canonical /working-list URL as
        // equivalent to the bare /posture root so direct navigation to
        // either resolves to the same active tab.
        const isWorkingList = tab.matchPath === "/account/sonar/posture";
        const isActive = isWorkingList
          ? pathname === tab.matchPath ||
            pathname === "/account/sonar/posture/working-list" ||
            pathname.startsWith("/account/sonar/posture/working-list/")
          : pathname === tab.matchPath || pathname.startsWith(`${tab.matchPath}/`);
        const showStartHere = !hasScopes && tab.segment === "working-list";
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
