"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { jsonFetcher } from "@/lib/swr-fetcher";
import { NavBadge } from "./nav-badge";
import { NavTooltip } from "./nav-tooltip";

// v1.37: Sonar IA split — the bilateral-request inbox lives at
// /account/sonar/requests (Active queue is the section default). The
// awaiting-me badge polls the same BFF route (counts haven't moved).
const REQUESTS_HREF = "/account/sonar/requests";

// v.1.43 Event Backlog relocation: the Backlog (Events / Gaps /
// Obligations) moved out of Sonar Observe and into Sonar Audit. The
// nav-visible entry is "Event Backlog" pointing at the Events tab as
// the default landing; Gaps + Obligations are reached via in-page tabs.
const BACKLOG_HREF = "/account/sonar/audit/events";

interface NavItem {
  href: string;
  label: string;
  indent?: boolean;
  /** One-sentence hover hint surfaced via <NavTooltip>. ~12-word target. */
  tooltip?: string;
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
  /** Optional secondary line shown beneath the section title in the
   *  gradient header — friendlier framing under the all-caps label. */
  subhead?: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    // v.1.43: Sonar Observe carries Watcher Backlog — the drift-events
    // surface (lead_time_degraded / lead_time_improved). It filters the
    // same /sonar/compliance/changes feed by change_kind allowlist (NOT
    // by source_kind); the audit-side Event Backlog under Sonar Audit
    // applies the inverse allowlist (the 7 audit kinds — origin shifts,
    // vendor sub, cert status, depth). The dual-surface partition is by
    // kind, not source.
    label: "Sonar Observe",
    subhead: "Supply Chain Monitoring",
    items: [
      { href: "/account/sonar/watchers", label: "Watcher Management", tooltip: "Standing watchers that fire when counterparty signals change." },
      { href: "/account/sonar/posture/changes", label: "Watcher Backlog", tooltip: "Drift events from your scheduled watcher configurations — lead-time degradations and improvements detected across the supplier network." },
      { href: "/account/sonar/observations", label: "Phantom Demand", tooltip: "Synthetic-demand probes that test counterparty capacity and lead times without committing to an order." },
      { href: REQUESTS_HREF, label: "Request Management", tooltip: "Track nominations and obligations in both directions — what you've sent to counterparties and what's awaiting your decision." },
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
    // v.1.41: Key Management (formerly "Provenance Keys" under Account
    // Management) moved here as a peer item — provenance keys exist
    // solely to gate audit visibility, so the configuration surface
    // belongs with the audit facilities. URL kept at
    // /account/provenance-keys (only the nav placement + label changed).
    label: "Sonar Audit",
    subhead: "Compliance Auditing",
    items: [
      { href: "/account/sonar/audit", label: "Audit Management", tooltip: "Run-led workflow view of audit activity: trigger new runs and review past ones across counterparties and SKUs." },
      { href: "/account/compliance", label: "Audit Backlog", tooltip: "Supplier-led workflow view of non-compliant audit findings — latest result per (vendor, product) across your recent runs." },
      { href: BACKLOG_HREF, label: "Event Backlog", tooltip: "Event-led workflow view of audit-data changes: origin shifts, vendor substitutions, certification status, depth changes. Sibling tabs cover Gaps and Obligations." },
      { href: "/account/provenance", label: "Product Provenance", tooltip: "Product-led workflow view that starts at product classes and resolves down to the component vendors behind each SKU." },
      { href: "/account/provenance-keys", label: "Key Management", tooltip: "Issue your own provenance keys and accept ones offered by counterparties — both directions gate audit visibility." },
    ],
  },
  {
    // v.1.42: Monitoring section dissolved — its four entries plus the
    // ex–Sonar Observe "Sonar Dashboard" lead Account Management. The two
    // dashboards sit first (System then Sonar) so the high-level overviews
    // are the entry points to this section.
    label: "Account Management",
    items: [
      { href: "/account", label: "System Dashboard", tooltip: "Snapshot of recent activity, alerts, and agent health across your HAIWAVE network." },
      { href: "/account/sonar/dashboard", label: "Sonar Dashboard", tooltip: "Unified view across audits, watchers, phantom demand, and templates." },
      { href: "/account/orders", label: "Orders", tooltip: "Browse inbound and outbound orders flowing between your agent and counterparties." },
      { href: "/account/scores", label: "Behavioral Scores", tooltip: "Reliability and response-time scores HAIWAVE assigns to you and your trading partners." },
      { href: "/account/agent-health", label: "Agent Health", tooltip: "Heartbeat, throttle, and error status for each provisioned HAIWAVE agent." },
      { href: "/account/agents", label: "Agents", tooltip: "Provision, configure, and monitor the HAIWAVE agents that act for your organization." },
      { href: "/account/partners", label: "Trading Partners", tooltip: "Counterparties you have an active bilateral relationship with on HAIWAVE." },
      { href: "/account/partners/blocked", label: "Blocked Companies", indent: true, tooltip: "Counterparties you've blocked from initiating relationships or visibility against you." },
      { href: "/account/manifests", label: "Manifests", tooltip: "Counterparty and pricing manifests that drive your agent's access rules and quoted prices." },
      { href: "/account/pricing", label: "Pricing", tooltip: "Pricing rules and inheritance configuration applied to your manifests." },
      { href: "/account/usage", label: "Usage", tooltip: "Request volume and rate-limit headroom against your HAIWAVE plan." },
      // Payments deferred to v2 — restore this entry when payments ships.
      // { href: "/account/payments", label: "Payments" },
      // v.1.41: Provenance Keys → Sonar Audit (as "Key Management").
      { href: "/account/data-cleansing", label: "Data Cleansing", tooltip: "Review and resolve classification or catalog data issues HAIWAVE has flagged." },
      { href: "/account/profile", label: "Company Profile", tooltip: "Edit your company's public profile, contact info, and business address." },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/account/settings/trust-posture", label: "Trust Posture", tooltip: "How aggressively your agent trusts and acts on signals coming from counterparties." },
      { href: "/account/security", label: "Sign-in & Security", tooltip: "Manage your password, two-factor authentication, and passkeys for signing in to HAIWAVE." },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/account/users", label: "Users", tooltip: "Manage the user accounts and roles inside your organization." },
      { href: "/account/billing", label: "Billing", tooltip: "Stripe subscription and metered-usage billing for your HAIWAVE account." },
    ],
  },
  {
    label: "Agent Software",
    items: [
      {
        href: "/account/agent-software",
        label: "Agent Software",
        tooltip: "Download the agent configuration guide and the latest agent client software.",
      },
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
      <div className="bg-white px-6 py-3">
        <Link href="/">
          <Image
            src="/img/haiwave-logo.png"
            alt="HAIWAVE"
            width={120}
            height={32}
            className="h-8 w-auto"
          />
        </Link>
      </div>
      <nav className="flex-1 py-5 overflow-y-auto">
        {navSections.map((section, idx) => (
          <div key={section.label} className={idx === 0 ? "pb-2" : "mt-6 pb-2"}>
            <div className="relative mb-2 py-2.5 px-6 bg-gradient-to-r from-teal/15 via-teal/[0.06] to-transparent border-l-[3px] border-teal">
              <div className="font-[family-name:var(--font-display)] text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
                {section.label}
              </div>
              {section.subhead && (
                <div className="mt-0.5 text-[11px] text-light-slate">
                  {section.subhead}
                </div>
              )}
            </div>
            {section.items.map((item) => {
              const isActive = isItemActive(item);
              let entry: React.ReactNode;
              if (item.href === REQUESTS_HREF) {
                entry = <RequestManagementNavItem item={item} isActive={isActive} />;
              } else if (item.href === BACKLOG_HREF) {
                entry = <BacklogNavItem item={item} isActive={isActive} />;
              } else {
                entry = (
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
                  </Link>
                );
              }
              return item.tooltip ? (
                <NavTooltip key={item.href} text={item.tooltip}>
                  {entry}
                </NavTooltip>
              ) : (
                <div key={item.href}>{entry}</div>
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
        {/* Logout is a mutation → POST form, never a prefetchable <Link>.
            Next prefetches visible <Link>s on navigation; a prefetch of the
            GET logout route silently destroyed the session, bouncing the
            user to re-login when merely moving between pages. */}
        <form action="/api/auth/logout" method="post" className="mt-3">
          <button
            type="submit"
            className="block text-xs text-light-slate hover:text-white transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </form>
      </div>
    </aside>
  );
}
