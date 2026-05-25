"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { jsonFetcher } from "@/lib/swr-fetcher";
import { NavBadge } from "./nav-badge";

// v1.37: Sonar IA split — the bilateral-request inbox lives at
// /account/sonar/requests (Active queue is the section default). The
// awaiting-me badge polls the same BFF route (counts haven't moved).
const REQUESTS_HREF = "/account/sonar/requests";

// v.1.41 Backlog IA: Sonar Observe > Posture renamed to Backlog. URL kept
// at /account/sonar/posture (label-only test per spec). The Backlog nav
// item carries an events-only badge — see BacklogNavItem.
const BACKLOG_HREF = "/account/sonar/posture";

interface NavItem {
  href: string;
  label: string;
  indent?: boolean;
}

interface RequestManagementCounts {
  awaiting_me_count: number;
  oldest_awaiting_me_age_days: number | null;
}

interface BacklogEventsCount {
  events_count: number;
  oldest_age_days: number | null;
}

function RequestManagementNavItem({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const { data, error } = useSWR<RequestManagementCounts>(
    "/api/sonar/compliance/requests/counts",
    jsonFetcher,
    { refreshInterval: 15_000 },
  );
  useEffect(() => {
    if (error) {
      console.warn("[RequestManagementNavItem] count poll failed", error);
    }
  }, [error]);
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 py-2.5 text-sm transition-colors ${
        item.indent ? "pl-10 pr-6" : "px-6"
      } ${
        isActive
          ? "text-white bg-white/10 border-r-2 border-teal"
          : "text-light-slate hover:text-white hover:bg-white/5"
      }`}
    >
      {item.label}
      <NavBadge
        count={data?.awaiting_me_count ?? 0}
        oldestAgeDays={data?.oldest_awaiting_me_age_days ?? null}
      />
      {error && (
        <span
          className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-slate-400"
          title="Live updates paused"
          aria-label="Live updates paused"
        />
      )}
    </Link>
  );
}

/**
 * Backlog sidebar entry — events-only count badge.
 *
 * Per v.1.41 Backlog IA spec Decision 11: no polling interval. Change
 * events surface at most nightly, so live polling would add request
 * volume for no signal. SWR's default revalidation (on mount / focus /
 * reconnect) is sufficient; users who want a fresh count can refresh
 * the page.
 */
function BacklogNavItem({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const { data, error } = useSWR<BacklogEventsCount>(
    "/api/account/sonar/backlog/events-count",
    jsonFetcher,
  );
  useEffect(() => {
    if (error) {
      console.warn("[BacklogNavItem] events count fetch failed", error);
    }
  }, [error]);
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 py-2.5 text-sm transition-colors ${
        item.indent ? "pl-10 pr-6" : "px-6"
      } ${
        isActive
          ? "text-white bg-white/10 border-r-2 border-teal"
          : "text-light-slate hover:text-white hover:bg-white/5"
      }`}
    >
      {item.label}
      <NavBadge
        count={data?.events_count ?? 0}
        oldestAgeDays={data?.oldest_age_days ?? null}
      />
    </Link>
  );
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: "Monitoring",
    items: [
      { href: "/account", label: "Dashboard" },
      { href: "/account/orders", label: "Orders" },
      { href: "/account/scores", label: "Behavioral Scores" },
      { href: "/account/agent-health", label: "Agent Health" },
    ],
  },
  {
    // v1.39: Sonar IA split — audit surface separated from observe surface.
    // v.1.41: Product Provenance moved under Sonar Audit — it's a
    // product-led view into supply-chain makeup, the read-only counterpart
    // to the supplier-led audit-run surface. URL kept at /account/provenance
    // (no redirect needed — only the nav placement + label changed).
    // v.1.41: Compliance moved here + renamed to Audit Exceptions — it's
    // the exception rollup across audits + inbound activity. URL stays at
    // /account/compliance.
    label: "Sonar Audit",
    items: [
      { href: "/account/sonar/audit", label: "Audits" },
      { href: "/account/compliance", label: "Audit Exceptions" },
      { href: "/account/provenance", label: "Product Provenance" },
    ],
  },
  {
    // v1.39: Observe surface: Dashboard, Request Management, Posture,
    // Observations, Configurations (templates). Reports dropped — the
    // /account/sonar/reports route was deleted in v1.40; the legacy URL now
    // 301-redirects to /account/sonar/audit.
    // v.1.41 Backlog IA (spec: 2026-05-23-v1_41-backlog-ia-restructure-design):
    // Posture → Backlog (label-only this PR; URL stays /sonar/posture).
    // Watcher Management is its own peer entry that lands with PR-5 (when the
    // relocated page actually exists) — adding it here would ship a 404 link.
    label: "Sonar Observe",
    items: [
      { href: "/account/sonar/dashboard", label: "Sonar Dashboard" },
      { href: REQUESTS_HREF, label: "Request Management" },
      { href: BACKLOG_HREF, label: "Backlog" },
      { href: "/account/sonar/observations", label: "Phantom Demand" },
      { href: "/account/sonar/templates", label: "Configurations" },
    ],
  },
  {
    label: "Account Management",
    items: [
      { href: "/account/agents", label: "Agents" },
      { href: "/account/partners", label: "Trading Partners" },
      { href: "/account/partners/blocked", label: "Blocked Companies", indent: true },
      { href: "/account/manifests", label: "Manifests" },
      { href: "/account/pricing", label: "Pricing" },
      { href: "/account/usage", label: "Usage" },
      // Payments deferred to v2 — restore this entry when payments ships.
      // { href: "/account/payments", label: "Payments" },
      { href: "/account/provenance-keys", label: "Provenance Keys" },
      { href: "/account/data-cleansing", label: "Data Cleansing" },
      { href: "/account/profile", label: "Company Profile" },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/account/settings/trust-posture", label: "Trust Posture" },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/account/users", label: "Users" },
      { href: "/account/billing", label: "Billing" },
    ],
  },
];

interface AccountNavProps {
  userName: string;
  userEmail: string;
}

export function AccountNav({ userName, userEmail }: AccountNavProps) {
  const pathname = usePathname();

  function isItemActive(item: NavItem): boolean {
    if (item.href === "/account") return pathname === "/account";
    // Prevent Trading Partners from highlighting when Blocked Companies is active
    if (item.href === "/account/partners") {
      return pathname === "/account/partners" || (pathname.startsWith("/account/partners/") && !pathname.startsWith("/account/partners/blocked"));
    }
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  return (
    <aside className="w-64 bg-navy text-white flex flex-col shrink-0">
      <div className="bg-white px-6 py-5">
        <Link href="/">
          <Image
            src="/img/haiwave-logo.png"
            alt="HAIWAVE"
            width={120}
            height={32}
            className="h-8 w-auto"
          />
        </Link>
        <p className="text-xs text-slate mt-1.5">Account Portal</p>
      </div>
      <nav className="flex-1 py-5 overflow-y-auto">
        {navSections.map((section, idx) => (
          <div key={section.label} className={idx === 0 ? "pb-2" : "mt-6 pb-2"}>
            <div className="relative mb-2 py-2.5 px-6 bg-gradient-to-r from-teal/15 via-teal/[0.06] to-transparent border-l-[3px] border-teal">
              <span className="font-[family-name:var(--font-display)] text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
                {section.label}
              </span>
            </div>
            {section.items.map((item) => {
              const isActive = isItemActive(item);
              if (item.href === REQUESTS_HREF) {
                return (
                  <RequestManagementNavItem key={item.href} item={item} isActive={isActive} />
                );
              }
              if (item.href === BACKLOG_HREF) {
                return (
                  <BacklogNavItem key={item.href} item={item} isActive={isActive} />
                );
              }
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 py-2.5 text-sm transition-colors ${
                    item.indent ? "pl-10 pr-6" : "px-6"
                  } ${
                    isActive
                      ? "text-white bg-white/10 border-r-2 border-teal"
                      : "text-light-slate hover:text-white hover:bg-white/5"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
        <div className="h-4" />
      </nav>
      <div className="p-6 border-t border-white/10">
        <p className="text-xs text-light-slate">Signed in as</p>
        <p className="text-sm text-white truncate mt-0.5">{userName}</p>
        <p className="text-xs text-light-slate truncate">{userEmail}</p>
        <Link
          href="/api/auth/logout"
          className="block mt-3 text-xs text-light-slate hover:text-white transition-colors"
        >
          Sign Out
        </Link>
      </div>
    </aside>
  );
}
