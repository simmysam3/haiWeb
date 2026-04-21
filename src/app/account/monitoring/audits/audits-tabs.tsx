"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

interface Tab {
  segment: string;
  label: string;
  href: string;
}

const tabs: Tab[] = [
  { segment: "dashboard", label: "Dashboard", href: "/account/monitoring/audits/dashboard" },
  { segment: "scopes", label: "Scope library", href: "/account/monitoring/audits/scopes" },
  { segment: "runs", label: "Runs", href: "/account/monitoring/audits/runs" },
];

export function AuditsTabs() {
  const active = useSelectedLayoutSegment();

  return (
    <div className="flex border-b border-slate/15 mb-6">
      {tabs.map((tab) => {
        const isActive = active === tab.segment;
        return (
          <Link
            key={tab.segment}
            href={tab.href}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              isActive
                ? "border-teal text-navy"
                : "border-transparent text-slate hover:text-charcoal"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
