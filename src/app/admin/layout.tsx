import Link from "next/link";

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
          <p className="text-xs text-orange mt-1">Admin Console</p>
        </div>
        <nav className="flex-1 py-4">
          <Link
            href="/admin"
            className="flex items-center gap-3 px-6 py-2.5 text-sm text-light-slate hover:text-white hover:bg-white/5 transition-colors"
          >
            Overview
          </Link>
        </nav>
      </aside>
      <main className="flex-1 bg-light-gray">
        <div className="max-w-[1200px] mx-auto p-8">{children}</div>
      </main>
    </div>
  );
}
