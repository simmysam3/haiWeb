export default function PartnersPage() {
  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-navy mb-2">
        Trading Partners
      </h1>
      <p className="text-slate mb-8">
        Discover companies, manage connections, and track partnership status.
      </p>

      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-slate/15 p-6">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-navy mb-3">
            Network Directory
          </h2>
          <p className="text-sm text-slate">
            Search registered HAIWAVE participants by company name, industry,
            product class, or location. Send connection requests (100/week
            limit).
          </p>
        </div>

        <div className="bg-white rounded-lg border border-slate/15 p-6">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-navy mb-3">
            Approval Queue
          </h2>
          <p className="text-sm text-slate">
            Pending inbound connection requests. Approve, decline, or ignore.
            Requests auto-expire after 30 days. Declined parties may re-request
            after 90 days.
          </p>
        </div>

        <div className="bg-white rounded-lg border border-slate/15 p-6">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-navy mb-3">
            Active Partnerships
          </h2>
          <p className="text-sm text-slate">
            Relationships at Approved or Trading Pair status. View manifest
            exchange progress, remove partnerships, ban counterparties.
          </p>
        </div>
      </div>
    </div>
  );
}
