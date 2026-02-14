export default function ScoresPage() {
  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-navy mb-2">
        Behavioral Scores
      </h1>
      <p className="text-slate mb-8">
        Your network performance as calculated by the Behavioral Registry.
      </p>

      <div className="bg-white rounded-lg border border-slate/15 p-6">
        <p className="text-sm text-slate">
          Read-only view: overall composite score, component scores (fulfillment
          reliability, response time, price adherence, agent uptime, exception
          rate), 30/60/90-day trends, vendor-side and buyer-side breakdowns.
        </p>
      </div>
    </div>
  );
}
