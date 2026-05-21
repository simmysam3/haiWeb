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

const tabs: Tab[] = [
  { segment: "posture/working-list", label: "Working list", href: "/account/sonar/compliance/posture/working-list", matchPath: "/account/sonar/compliance/posture/working-list" },
  { segment: "posture/coverage", label: "Coverage", href: "/account/sonar/compliance/posture/coverage", matchPath: "/account/sonar/compliance/posture/coverage" },
  { segment: "requests", label: "Nominations", href: "/account/sonar/compliance/requests?awaiting=them&type=nomination", matchPath: "/account/sonar/compliance/requests" },
  { segment: "posture/obligations", label: "Obligations · Inbound", href: "/account/sonar/compliance/posture/obligations", matchPath: "/account/sonar/compliance/posture/obligations" },
  { segment: "posture/changes", label: "Changes", href: "/account/sonar/compliance/posture/changes", matchPath: "/account/sonar/compliance/posture/changes" },
  { segment: "evidence/new", label: "New response", href: "/account/sonar/compliance/evidence/new", matchPath: "/account/sonar/compliance/evidence/new" },
  { segment: "evidence/responses", label: "Responses", href: "/account/sonar/compliance/evidence/responses", matchPath: "/account/sonar/compliance/evidence/responses" },
  { segment: "runs", label: "Runs", href: "/account/sonar/compliance/runs", matchPath: "/account/sonar/compliance/runs" },
];

export function ComplianceTabs({ hasScopes }: { hasScopes: boolean }) {
  const pathname = usePathname();

  return (
    <div className="flex border-b border-slate/15 mb-6">
      {tabs.map((tab) => {
        const isActive =
          pathname === tab.matchPath || pathname.startsWith(`${tab.matchPath}/`);
        const showStartHere = !hasScopes && tab.segment === "requests";
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
