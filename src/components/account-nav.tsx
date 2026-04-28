"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  indent?: boolean;
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
      { href: "/account/provenance", label: "Provenance" },
      { href: "/account/compliance", label: "Compliance" },
      { href: "/account/agent-health", label: "Agent Health" },
    ],
  },
  {
    label: "Sonar",
    items: [
      { href: "/account/sonar/audit/dashboard", label: "Audit Dashboard" },
      { href: "/account/sonar/audit/runs", label: "Audit Runs" },
      { href: "/account/sonar/audit/nominations", label: "My Nominations" },
      { href: "/account/sonar/audit/downstream-gaps", label: "My Downstream Gaps" },
      { href: "/account/sonar/audit/reports", label: "Audit Reports" },
      { href: "/account/sonar/phantom-demand/dashboard", label: "Phantom Demand" },
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
      { href: "/account/payments", label: "Payments" },
      { href: "/account/provenance-keys", label: "Provenance Keys" },
      { href: "/account/data-cleansing", label: "Data Cleansing" },
      { href: "/account/profile", label: "Company Profile" },
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
