import Link from "next/link";

const adminNav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/participants", label: "Participants" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-charcoal text-white flex flex-col shrink-0">
        <div className="p-6 border-b border-white/10">
          <Link href="/admin" className="text-lg font-bold tracking-tight">
            HAIWAVE
          </Link>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-orange">Admin Console</p>
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-orange text-white rounded">
              ADMIN
            </span>
          </div>
        </div>
        <nav className="flex-1 py-4">
          {adminNav.map((item) => (
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
          <Link
            href="/account"
            className="text-xs text-light-slate hover:text-white transition-colors"
          >
            Back to Portal
          </Link>
        </div>
      </aside>
      <main className="flex-1 bg-light-gray">
        <div className="max-w-[1200px] mx-auto p-8">{children}</div>
      </main>
    </div>
  );
}
