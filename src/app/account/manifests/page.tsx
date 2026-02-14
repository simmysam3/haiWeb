export default function ManifestsPage() {
  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-navy mb-2">
        Manifests
      </h1>
      <p className="text-slate mb-8">
        Configure counterparty requirements and baseline pricing defaults.
      </p>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-slate/15 p-6">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-navy mb-3">
            Counterparty Manifest
          </h2>
          <p className="text-sm text-slate">
            Inbound requirements (what we require from counterparties): W9, COI,
            resale certificate, etc. Outbound postures (support, not_supported,
            exception) with document upload for supported items. Conditional
            auto-approval via behavioral score thresholds.
          </p>
        </div>

        <div className="bg-white rounded-lg border border-slate/15 p-6">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-navy mb-3">
            Baseline Pricing
          </h2>
          <p className="text-sm text-slate">
            Company-wide defaults: currency, payment terms, freight terms,
            minimum order value, quote validity, volume discount tiers, aged
            inventory discounts. Product-specific overrides deferred to Phase 2
            (ERP integration).
          </p>
        </div>
      </div>
    </div>
  );
}
