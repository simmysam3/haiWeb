export default function BillingPage() {
  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-navy mb-2">
        Billing
      </h1>
      <p className="text-slate mb-8">
        Subscription, payment methods, and invoice history.
      </p>

      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-slate/15 p-6">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-navy mb-3">
            Subscription
          </h2>
          <p className="text-sm text-slate">
            HAIWAVE Platform: $10,000/year. Billing cycle, payment status,
            connection fee tier summary, estimated next month total. Accessible
            to account_owner only.
          </p>
        </div>

        <div className="bg-white rounded-lg border border-slate/15 p-6">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-navy mb-3">
            Payment Method
          </h2>
          <p className="text-sm text-slate">
            Managed via Stripe: credit card, ACH, wire transfer. Toggle between
            auto-charge and invoiced billing (requires HAIWAVE admin approval).
          </p>
        </div>

        <div className="bg-white rounded-lg border border-slate/15 p-6">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-navy mb-3">
            Invoice History
          </h2>
          <p className="text-sm text-slate">
            All invoices from Stripe: date, description, amount, status. PDF
            download. Connection fee detail with per-pair breakdown and tiered
            rates.
          </p>
        </div>
      </div>
    </div>
  );
}
