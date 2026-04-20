import { CatalogTree } from './catalog-tree';
import { KeyNudgeBanner } from './key-nudge-banner';

export default async function PartnerCatalogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-charcoal mb-4">Catalog — Audit Scope</h1>
      <p className="text-sm text-slate mb-6">
        Pick what to audit from this vendor. Scope can be company-wide, specific product classes, or individual products.
      </p>
      <KeyNudgeBanner vendorId={id} />
      <CatalogTree vendorId={id} />
    </div>
  );
}
