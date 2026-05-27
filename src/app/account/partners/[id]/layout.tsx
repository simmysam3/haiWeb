import type { ReactNode } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
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
    <div>
      <nav className="text-xs text-slate mb-3">
        <Link href="/account/partners" className="hover:text-navy">Partners</Link>
        <span className="mx-1.5">/</span>
        <span className="text-charcoal">{vendorName ?? 'Vendor'}</span>
      </nav>
      <PageHeader title={vendorName ?? 'Vendor'} />
      <PartnerTabs vendorId={id} />
      {children}
    </div>
  );
}
