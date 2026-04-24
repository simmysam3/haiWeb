import type { ReactNode } from "react";
import Link from "next/link";
import { PartnerTabs } from "./partner-tabs";
import { getVendorName } from "./_lib/vendor";

export default async function PartnerDetailLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const vendorName = await getVendorName(id);
  return (
    <div className="p-6">
      <nav className="text-xs text-slate mb-3">
        <Link href="/account/partners" className="hover:text-navy">Partners</Link>
        <span className="mx-1.5">/</span>
        <span className="text-charcoal">{vendorName ?? 'Vendor'}</span>
      </nav>
      <h1 className="text-xl font-semibold text-charcoal mb-4">
        {vendorName ?? 'Vendor'}
      </h1>
      <PartnerTabs vendorId={id} />
      {children}
    </div>
  );
}
