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

// v.1.41 Backlog IA — mode-switching tabs. Three independent surfaces; no
// unified default view. The section root /sonar/posture renders Events
// (its default mode); the Events tab href points at the canonical
// /sonar/posture/changes URL so both paths keep the Events tab active.
//
// Dropped from this list vs the v1.37 Posture tabs:
//   - "Working list" — the section root IS the backlog; a tab restating
//     the URL was redundant. Replaced by the Gaps mode (single-category
//     view of the working-list endpoint).
//   - "Watchers" — relocated out of Backlog to its own Sonar Observe
//     sidebar entry in PR-5. Until that PR lands, /sonar/posture/runs is
//     orphaned from in-section nav (still resolves by direct URL).
const tabs: Tab[] = [
  {
    segment: "changes",
    label: "Events",
    href: "/account/sonar/posture/changes",
    matchPath: "/account/sonar/posture/changes",
  },
  {
    segment: "working-list",
    label: "Gaps",
    href: "/account/sonar/posture/working-list",
    matchPath: "/account/sonar/posture/working-list",
  },
  {
    segment: "obligations",
    label: "Obligations",
    href: "/account/sonar/posture/obligations",
    matchPath: "/account/sonar/posture/obligations",
  },
];

export function BacklogTabs({ hasScopes }: { hasScopes: boolean }) {
  const pathname = usePathname();

  return (
    <div className="flex border-b border-slate/15 mb-6">
      {tabs.map((tab) => {
        // Events is the section-root default — both `/posture` and the
        // canonical `/posture/changes` (plus any deeper `/changes/:id`)
        // must light the Events tab. The other tabs are leaf paths so
        // prefix-startsWith correctly keeps the parent tab highlighted
        // on sub-routes.
        const isEvents = tab.matchPath === "/account/sonar/posture/changes";
        const isActive = isEvents
          ? pathname === "/account/sonar/posture" ||
            pathname === tab.matchPath ||
            pathname.startsWith(`${tab.matchPath}/`)
          : pathname === tab.matchPath || pathname.startsWith(`${tab.matchPath}/`);
        // "Start here" anchor: the empty-state CTA lives on Gaps (the
        // working-list-derived surface) — first-run users with no
        // scopes configured land on Events by default but the actionable
        // setup flow is reached by clicking Gaps.
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
