import { PageHeader } from '@/components';
import { ForecastWizard } from './_components/forecast-wizard';

// v1.62 — thin server shell over the client wizard, matching the watcher
// wizard page: the form owns all of its own state and submission.
export default function GroundedForecastNewPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="New grounded forecast"
        title="Create a grounded forecast"
        description="Name a product that does not exist yet, nominate the predecessors it resembles, shape its bill of materials and demand profile — a run grounds the projection against live network quotes and your own delivery history."
      />
      <ForecastWizard />
    </div>
  );
}
