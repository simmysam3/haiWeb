"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/account", label: "Dashboard" },
  { href: "/account/profile", label: "Company Profile" },
  { href: "/account/users", label: "Users" },
  { href: "/account/agents", label: "Agents" },
  { href: "/account/manifests", label: "Manifests" },
  { href: "/account/pricing", label: "Pricing" },
  { href: "/account/partners", label: "Trading Partners" },
  { href: "/account/partners/blocked", label: "Blocked Companies" },
  { href: "/account/scores", label: "Behavioral Scores" },
  { href: "/account/billing", label: "Billing" },
];

interface AccountNavProps {
  userName: string;
  userEmail: string;
}

export function AccountNav({ userName, userEmail }: AccountNavProps) {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-navy text-white flex flex-col shrink-0">
      <div className="p-6 border-b border-white/10">
        <Link href="/" className="text-lg font-bold tracking-tight">
          HAIWAVE
        </Link>
        <p className="text-xs text-light-slate mt-1">Account Portal</p>
      </div>
      <nav className="flex-1 py-4">
        {navItems.map((item) => {
          const isActive = item.href === "/account"
            ? pathname === "/account"
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-6 py-2.5 text-sm transition-colors ${
                isActive
                  ? "text-white bg-white/10 border-r-2 border-teal"
                  : "text-light-slate hover:text-white hover:bg-white/5"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
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
