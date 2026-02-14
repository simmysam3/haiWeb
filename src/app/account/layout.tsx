import Link from "next/link";

const navItems = [
  { href: "/account", label: "Dashboard", icon: "grid" },
  { href: "/account/profile", label: "Company Profile", icon: "building" },
  { href: "/account/users", label: "Users", icon: "users" },
  { href: "/account/agents", label: "Agents", icon: "cpu" },
  { href: "/account/manifests", label: "Manifests", icon: "file-text" },
  { href: "/account/partners", label: "Trading Partners", icon: "handshake" },
  { href: "/account/scores", label: "Behavioral Scores", icon: "bar-chart" },
  { href: "/account/billing", label: "Billing", icon: "credit-card" },
];

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-navy text-white flex flex-col shrink-0">
        <div className="p-6 border-b border-white/10">
          <Link href="/" className="text-lg font-bold tracking-tight">
            HAIWAVE
          </Link>
          <p className="text-xs text-light-slate mt-1">Account Portal</p>
        </div>
        <nav className="flex-1 py-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-6 py-2.5 text-sm text-light-slate hover:text-white hover:bg-white/5 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-6 border-t border-white/10">
          <p className="text-xs text-light-slate">Signed in as</p>
          <p className="text-sm text-white truncate mt-0.5">user@company.com</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-light-gray">
        <div className="max-w-[1200px] mx-auto p-8">{children}</div>
      </main>
    </div>
  );
}
