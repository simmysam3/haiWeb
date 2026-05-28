"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Tab {
  segment: string;
  label: string;
  href: string;
  matchPath: string;
}

// v.1.43 Event Backlog relocation — the three Backlog tabs (Events, Gaps,
// Obligations) moved out of /sonar/posture and now live under the Sonar Audit
// section. Events is the nav-visible "Event Backlog" entry; Gaps and
// Obligations are peer sub-routes reachable via this tab strip.
const tabs: Tab[] = [
  {
    segment: "events",
    label: "Events",
    href: "/account/sonar/audit/events",
    matchPath: "/account/sonar/audit/events",
  },
  {
    segment: "gaps",
    label: "Gaps",
    href: "/account/sonar/audit/gaps",
    matchPath: "/account/sonar/audit/gaps",
  },
  {
    segment: "obligations",
    label: "Obligations",
    href: "/account/sonar/audit/obligations",
    matchPath: "/account/sonar/audit/obligations",
  },
];

export function BacklogTabs({ hasScopes }: { hasScopes: boolean }) {
  const pathname = usePathname();

  return (
    <div className="flex border-b border-slate/15 mb-6">
      {tabs.map((tab) => {
        const isActive =
          pathname === tab.matchPath || pathname.startsWith(`${tab.matchPath}/`);
        // "Start here" anchor: the empty-state CTA lives on Gaps — first-run
        // users with no audit scopes configured reach the actionable setup
        // flow by clicking Gaps.
        const showStartHere = !hasScopes && tab.segment === "gaps";
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
