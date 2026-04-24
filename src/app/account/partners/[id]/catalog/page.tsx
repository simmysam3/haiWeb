import { CatalogTree } from './catalog-tree';
import { KeyNudgeBanner } from './key-nudge-banner';

export default async function PartnerCatalogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div>
      <p className="text-sm text-slate mb-4">
        Pick what to audit from this vendor. Scope can be company-wide,
        specific product classes, or individual products.
      </p>
      <KeyNudgeBanner vendorId={id} />
      <CatalogTree vendorId={id} />
    </div>
  );
}
