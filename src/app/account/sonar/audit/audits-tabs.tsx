"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

interface Tab {
  segment: string;
  label: string;
  href: string;
}

const tabs: Tab[] = [
  { segment: "dashboard", label: "Dashboard", href: "/account/sonar/audit/dashboard" },
  { segment: "nominations", label: "My nominations", href: "/account/sonar/observations?tab=audit" },
  { segment: "runs", label: "Runs", href: "/account/sonar/observations?tab=audit" },
];

export function AuditsTabs({ hasScopes }: { hasScopes: boolean }) {
  const active = useSelectedLayoutSegment();

  return (
    <div className="flex border-b border-slate/15 mb-6">
      {tabs.map((tab) => {
        const isActive = active === tab.segment;
        const showStartHere = !hasScopes && tab.segment === "nominations";
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
