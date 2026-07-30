import { PageHeader } from '@/components';
import { ForecastList } from './_components/forecast-list';

// v1.62 — the Grounded Forecasts home. A thin server shell over a client list,
// matching the Phantom Demand home: the list owns its own fetching so a run
// started from a row can refresh the table without a full navigation.
export default function GroundedForecastsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Grounded Forecasts"
        description={
          <>
            <strong className="text-charcoal">
              From a projection to a commitment schedule.
            </strong>{' '}
            Describe a product you have not built yet — the predecessors it
            resembles, its bill of materials, how many per month — and a run
            grounds that projection against live network quotes and your own
            delivery history to say what must be committed, and by when.
          </>
        }
      />
      <ForecastList />
    </div>
  );
}
