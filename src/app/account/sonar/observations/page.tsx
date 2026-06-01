import { PageHeader } from '@/components';
import { PhantomDemandQueue } from './_components/phantom-demand-queue';

// v.1.45 — the Phantom Demand home is now a queue of saved requests (configs),
// each showing its latest run + Re-run / Config / Output actions. The client
// component owns its own data fetching + polling.
export default function ObservationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Phantom Demand"
        description={
          <>
            Procurement questions — ask &ldquo;if I needed N units of X, when
            could you deliver?&rdquo; without committing to an order. Run a saved
            request, then open its output for the BOM breakdown.
          </>
        }
      />
      <PhantomDemandQueue />
    </div>
  );
}
